package com.weizhi.agent.controller;

import com.weizhi.agent.model.ChatMedia;
import com.weizhi.agent.model.ChatResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.weizhi.agent.service.AiSettingsService;
import com.weizhi.agent.service.HistoryService;
import com.weizhi.agent.service.ImageRequestDetector;
import com.weizhi.agent.service.MessageResolver;
import com.weizhi.agent.tools.FileUtils;
import com.weizhi.agent.tools.SearchTools;
import okhttp3.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/chat")
public class ChatController {
    private static final Logger log = LoggerFactory.getLogger(ChatController.class);
    private static final Pattern IMAGE_URL = Pattern.compile("/api/images/files/[A-Za-z0-9._-]+");
    private static final Pattern AUDIO_URL = Pattern.compile("/api/tts/audio/[A-Za-z0-9._-]+");

    private final ObjectMapper objectMapper;
    private final OkHttpClient httpClient;
    private final AiSettingsService settingsService;
    private final HistoryService historyService;
    private final SearchTools searchTools;

    @Value("${minimax.chat-endpoint}")
    private String chatEndpoint;

    @Value("${minimax.image-generation-endpoint}")
    private String imageGenerationEndpoint;

    @Value("${app.generated-images-path:generated_images}")
    private String generatedImagesPath;

    public ChatController(OkHttpClient okHttpClient, ObjectMapper objectMapper,
                          AiSettingsService settingsService, HistoryService historyService,
                          SearchTools searchTools) {
        this.httpClient = okHttpClient;
        this.objectMapper = objectMapper;
        this.settingsService = settingsService;
        this.historyService = historyService;
        this.searchTools = searchTools;
    }

    @PostMapping("/ask")
    public ChatResponse ask(@org.springframework.web.bind.annotation.RequestBody Map<String, Object> requestBody) {
        List<Map<String, String>> messages = MessageResolver.resolve(requestBody);
        ChatResponse response = new ChatResponse();
        if (messages.isEmpty()) {
            response.setText("请输入问题。");
            response.setMedia(new ArrayList<>());
            return response;
        }

        Map<String, String> lastMsgMap = messages.get(messages.size() - 1);
        String lastRole = lastMsgMap.get("role");
        String lastInput = lastMsgMap.get("content");

        if ("user".equals(lastRole) && ImageRequestDetector.looksLikeImageRequest(lastInput)) {
            String url = generateImageFromPrompt(lastInput);
            response.setText(url != null ? "图片已生成: " + url : "图片生成失败，请稍后重试。");
            response.setMedia(extractMedia(response.getText()));
            return response;
        }

        injectDateSnippetToLastUserMessage(messages);

        String text;
        try {
            text = callChat(messages);
        } catch (Exception e) {
            response.setText("问答失败: " + e.getMessage());
            response.setMedia(new ArrayList<>());
            return response;
        }
        if (text == null || text.isBlank()) {
            text = "模型返回为空，请重试。";
        }
        response.setText(text);
        response.setMedia(extractMedia(text));
        return response;
    }

    @PostMapping(value = "/stream", produces = org.springframework.http.MediaType.TEXT_EVENT_STREAM_VALUE)
    public org.springframework.web.servlet.mvc.method.annotation.SseEmitter stream(@org.springframework.web.bind.annotation.RequestBody Map<String, Object> requestBody) {
        org.springframework.web.servlet.mvc.method.annotation.SseEmitter emitter = new org.springframework.web.servlet.mvc.method.annotation.SseEmitter(180000L);
        String apiKey = settingsService.apiKey("minimax");
        String model = settingsService.model("minimax");
        List<Map<String, String>> messages = MessageResolver.resolve(requestBody);

        if (messages.isEmpty() || apiKey == null || apiKey.isBlank()) {
            try {
                emitter.send("MiniMax 未配置或输入为空");
                emitter.complete();
            } catch (Exception ignored) {}
            return emitter;
        }

        injectDateSnippetToLastUserMessage(messages);

        java.util.concurrent.CompletableFuture.runAsync(() -> {
            try {
                java.time.LocalDate now = java.time.LocalDate.now();
                String formattedDate = now.format(java.time.format.DateTimeFormatter.ofPattern("yyyy年MM月dd日"));
                String[] cnWeeks = {"", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"};
                String dayOfWeek = cnWeeks[now.getDayOfWeek().getValue()];
                String dateSnippet = "\n\n[当前系统时效环境]\n- 当前日期：" + formattedDate + " (" + dayOfWeek + ")\n- 当前年份：2026年\n请始终基于此系统时效环境为用户解答日期与时序相关的问题。";

                List<Map<String, Object>> requestMessages = new ArrayList<>();
                requestMessages.add(Map.of("role", "system", "content", "你运行在 Weizhi Agent 的 MiniMax 流式会话中。" + dateSnippet));
                for (Map<String, String> msg : messages) {
                    requestMessages.add(new LinkedHashMap<>(msg));
                }

                String currentModel = model;
                boolean toolCalled = false;

                List<Map<String, Object>> tools = List.of(
                    Map.of(
                        "type", "function",
                        "function", Map.of(
                            "name", "web_search",
                            "description", "实时网络搜索，用于获取当天的实时日期、时事新闻、最新技术文档或需要查询互联网的实时公开信息。",
                            "parameters", Map.of(
                                "type", "object",
                                "properties", Map.of(
                                    "query", Map.of(
                                        "type", "string",
                                        "description", "进行网络搜索的关键字或查询句。"
                                    )
                                ),
                                "required", List.of("query")
                            )
                        )
                    )
                );

                // Perform a fast non-streaming probe to see if the LLM wants to call a tool
                try {
                    Map<String, Object> probePayload = new LinkedHashMap<>();
                    probePayload.put("model", currentModel);
                    probePayload.put("messages", requestMessages);
                    probePayload.put("temperature", 0.7);
                    probePayload.put("max_tokens", 256);
                    probePayload.put("tools", tools);

                    Request probeRequest = new Request.Builder()
                            .url(chatEndpoint)
                            .addHeader("Authorization", "Bearer " + apiKey)
                            .addHeader("Content-Type", "application/json")
                            .post(RequestBody.create(objectMapper.writeValueAsString(probePayload), MediaType.parse("application/json")))
                            .build();

                    try (Response probeResponse = httpClient.newCall(probeRequest).execute()) {
                        if (probeResponse.isSuccessful() && probeResponse.body() != null) {
                            String raw = probeResponse.body().string();
                            JsonNode root = objectMapper.readTree(raw);
                            JsonNode messageNode = root.path("choices").path(0).path("message");
                            JsonNode toolCallsNode = messageNode.path("tool_calls");

                            if (toolCallsNode != null && !toolCallsNode.isMissingNode() && toolCallsNode.size() > 0) {
                                JsonNode toolCall = toolCallsNode.get(0);
                                String callId = toolCall.path("id").asText();
                                String functionName = toolCall.path("function").path("name").asText();
                                String argumentsJson = toolCall.path("function").path("arguments").asText();

                                if ("web_search".equals(functionName)) {
                                    JsonNode argsNode = objectMapper.readTree(argumentsJson);
                                    String query = argsNode.path("query").asText();
                                    log.info("MiniMax stream requested web_search for query: '{}'", query);

                                    // Run Search
                                    String searchContext = searchTools.search(query);

                                    // Append Assistant tool call
                                    Map<String, Object> assistantMessage = new LinkedHashMap<>();
                                    assistantMessage.put("role", "assistant");
                                    assistantMessage.put("content", messageNode.path("content").asText(""));
                                    assistantMessage.put("tool_calls", objectMapper.convertValue(toolCallsNode, List.class));
                                    requestMessages.add(assistantMessage);

                                    // Append Tool response
                                    Map<String, Object> toolMessage = new LinkedHashMap<>();
                                    toolMessage.put("role", "tool");
                                    toolMessage.put("tool_call_id", callId);
                                    toolMessage.put("name", "web_search");
                                    toolMessage.put("content", searchContext);
                                    requestMessages.add(toolMessage);

                                    toolCalled = true;
                                }
                            }
                        }
                    }
                } catch (Exception e) {
                    log.warn("MiniMax tool probe failed, falling back to normal streaming without tools: {}", e.getMessage());
                }

                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("model", currentModel);
                payload.put("messages", requestMessages);
                payload.put("temperature", 0.7);
                payload.put("stream", true);

                Request request = new Request.Builder()
                        .url(chatEndpoint)
                        .addHeader("Authorization", "Bearer " + apiKey)
                        .addHeader("Content-Type", "application/json")
                        .post(RequestBody.create(objectMapper.writeValueAsString(payload), MediaType.parse("application/json")))
                        .build();

                try (Response response = httpClient.newCall(request).execute()) {
                    if (!response.isSuccessful()) {
                        String raw = response.body() == null ? "" : response.body().string();
                        emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter.event()
                                .name("error").data("HTTP Error: " + response.code() + " - " + raw));
                        emitter.complete();
                        return;
                    }

                    okio.BufferedSource source = response.body().source();
                    while (!source.exhausted()) {
                        String line = source.readUtf8Line();
                        if (line == null) break;
                        if (line.startsWith("data:")) {
                            String data = line.substring(5).trim();
                            if ("[DONE]".equals(data)) {
                                break;
                            }
                            try {
                                JsonNode chunk = objectMapper.readTree(data);
                                String delta = chunk.path("choices").path(0).path("delta").path("content").asText("");
                                if (!delta.isEmpty()) {
                                    emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter.event().data(delta));
                                }
                            } catch (Exception ignored) {}
                        }
                    }
                    emitter.complete();
                }
            } catch (Exception e) {
                try {
                    emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter.event()
                            .name("error").data(e.getMessage()));
                    emitter.complete();
                } catch (Exception ignored) {}
            }
        });
        return emitter;
    }

    @PostMapping("/translate")
    public Map<String, Object> translate(@org.springframework.web.bind.annotation.RequestBody Map<String, Object> request) {
        String text = (String) request.get("text");
        String sourceLang = (String) request.get("sourceLang");
        String targetLang = (String) request.get("targetLang");
        String style = (String) request.get("style");

        if (text == null || text.isBlank()) {
            return Map.of("success", false, "error", "原文不能为空");
        }

        String target = "Japanese".equalsIgnoreCase(targetLang) ? "日语" : "Chinese".equalsIgnoreCase(targetLang) ? "中文" : "English".equalsIgnoreCase(targetLang) ? "英语" : targetLang;

        String styleInstruction = "oral".equalsIgnoreCase(style) ? "使用自然、日常口语化、口头化的语气，符合目标语言（" + target + "）的日常生活对话或动漫日剧等实际交际场景。"
                : "polite".equalsIgnoreCase(style) ? "使用得体、正式、有礼貌的语气。如果目标语言是日语，请务必使用标准的敬语（包括丁寧语、尊敬语或谦譲语，如です/ます体）。"
                : "literary".equalsIgnoreCase(style) ? "使用优美、生动、具有文学美感艺术色彩的书面语语气，符合目标语言（" + target + "）的书面文学表达规范。"
                : "使用标准、中性、客观的语气，确保意思表达准确。";

        String systemPrompt = "你是一个极其严格的翻译引擎。你的唯一任务是将以下用户输入的文本翻译为" + target + "。\n"
                + "要求：\n1. " + styleInstruction + "\n"
                + "2. 仅输出翻译后的最终结果（" + target + " 译文）。除翻译后的目标语言纯文本外，绝对不要输出任何非目标语言词汇、中文解释、拼音、假名标音或多余文字。\n"
                + "3. 翻译出来的结果必须是纯粹且地道的" + target + "，绝对禁止将源语言中的中文词汇混入或保留在译文里。\n"
                + "4. 绝对不要提供多种翻译方案，只需输出最契合该语气风格的一种最完美的翻译结果。\n"
                + "5. 绝对不要添加任何引号、前言或后缀。严格保持原有的段落和换行格式。";

        try {
            String model = settingsService.model("minimax");
            List<Map<String, Object>> requestMessages = new ArrayList<>();
            String userPrompt = systemPrompt + "\n\n==== 待翻译的原文本开始 ====\n" + text + "\n==== 待翻译的原文本结束 ====\n请立即直接输出纯粹且完美的 " + target + " 译文：";
            requestMessages.add(Map.of("role", "user", "content", userPrompt));

            String translatedText = callChatRaw(requestMessages, model, 0.1);
            if (translatedText.startsWith("问答失败: ")) {
                return Map.of("success", false, "error", translatedText);
            }

            if (translatedText.contains("<think>")) {
                int start = translatedText.indexOf("<think>");
                int end = translatedText.indexOf("</think>");
                translatedText = (end != -1) ? translatedText.substring(end + 8).trim() : translatedText.substring(0, start).trim();
            }

            return Map.of("success", true, "translation", translatedText);
        } catch (Exception e) {
            log.error("Translation failed: {}", e.getMessage(), e);
            return Map.of("success", false, "error", e.getMessage());
        }
    }

    private String callChat(List<Map<String, String>> messages) {
        String model = settingsService.model("minimax");
        java.time.LocalDate now = java.time.LocalDate.now();
        String formattedDate = now.format(java.time.format.DateTimeFormatter.ofPattern("yyyy年MM月dd日"));
        String[] cnWeeks = {"", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"};
        String dayOfWeek = cnWeeks[now.getDayOfWeek().getValue()];
        String dateSnippet = "\n\n[当前系统时效环境]\n- 当前日期：" + formattedDate + " (" + dayOfWeek + ")\n- 当前年份：2026年\n请始终基于此系统时效环境为用户解答日期与时序相关的问题。";

        List<Map<String, Object>> requestMessages = new ArrayList<>();
        requestMessages.add(Map.of(
                "role", "system",
                "content", "你运行在 Weizhi Agent 的 MiniMax 创作会话中。当前使用的模型是 " + model + "。"
                        + "当用户询问你是什么模型、是否免费、底层模型或计费方式时，必须明确说明：这是通过 API 调用的商业模型服务，不是免费用户的消费级产品；API 按 token 计费，费用由配置 API Key 的账户承担。"
                        + "绝对不要声称自己是完全免费、可以无限使用的。" + dateSnippet
        ));
        for (Map<String, String> msg : messages) {
            requestMessages.add(new LinkedHashMap<>(msg));
        }

        List<Map<String, Object>> tools = List.of(
            Map.of(
                "type", "function",
                "function", Map.of(
                    "name", "web_search",
                    "description", "实时网络搜索，用于获取当天的实时日期、时事新闻、最新技术文档或需要查询互联网的实时公开信息。",
                    "parameters", Map.of(
                        "type", "object",
                        "properties", Map.of(
                            "query", Map.of(
                                "type", "string",
                                "description", "进行网络搜索的关键字或查询句。"
                            )
                        ),
                        "required", List.of("query")
                    )
                )
            )
        );

        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("model", model);
            payload.put("messages", requestMessages);
            payload.put("temperature", 0.7);
            payload.put("max_tokens", 2048);
            payload.put("tools", tools);

            Request request = new Request.Builder()
                    .url(chatEndpoint)
                    .addHeader("Authorization", "Bearer " + settingsService.apiKey("minimax"))
                    .addHeader("Content-Type", "application/json")
                    .post(RequestBody.create(objectMapper.writeValueAsString(payload), MediaType.parse("application/json")))
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                String raw = response.body() == null ? "" : response.body().string();
                if (!response.isSuccessful()) {
                    log.warn("Minimax call with tools failed with status {}. Retrying without tools...", response.code());
                    payload.remove("tools");
                    Request retryRequest = new Request.Builder()
                            .url(chatEndpoint)
                            .addHeader("Authorization", "Bearer " + settingsService.apiKey("minimax"))
                            .addHeader("Content-Type", "application/json")
                            .post(RequestBody.create(objectMapper.writeValueAsString(payload), MediaType.parse("application/json")))
                            .build();
                    try (Response retryResponse = httpClient.newCall(retryRequest).execute()) {
                        raw = retryResponse.body() == null ? "" : retryResponse.body().string();
                        if (!retryResponse.isSuccessful()) {
                            return "问答失败: " + retryResponse.code() + " - " + raw;
                        }
                    }
                }

                JsonNode root = objectMapper.readTree(raw);
                JsonNode messageNode = root.path("choices").path(0).path("message");
                JsonNode toolCallsNode = messageNode.path("tool_calls");

                if (toolCallsNode != null && !toolCallsNode.isMissingNode() && toolCallsNode.size() > 0) {
                    JsonNode toolCall = toolCallsNode.get(0);
                    String callId = toolCall.path("id").asText();
                    String functionName = toolCall.path("function").path("name").asText();
                    String argumentsJson = toolCall.path("function").path("arguments").asText();

                    if ("web_search".equals(functionName)) {
                        JsonNode argsNode = objectMapper.readTree(argumentsJson);
                        String query = argsNode.path("query").asText();
                        log.info("MiniMax requested web_search tool call for query: '{}'", query);

                        // 1. Run Search
                        String searchContext = searchTools.search(query);

                        // 2. Append Assistant Message (containing tool_calls)
                        Map<String, Object> assistantMessage = new LinkedHashMap<>();
                        assistantMessage.put("role", "assistant");
                        assistantMessage.put("content", messageNode.path("content").asText(""));
                        assistantMessage.put("tool_calls", objectMapper.convertValue(toolCallsNode, List.class));
                        requestMessages.add(assistantMessage);

                        // 3. Append Tool Message
                        Map<String, Object> toolMessage = new LinkedHashMap<>();
                        toolMessage.put("role", "tool");
                        toolMessage.put("tool_call_id", callId);
                        toolMessage.put("name", "web_search");
                        toolMessage.put("content", searchContext);
                        requestMessages.add(toolMessage);

                        // 4. Call MiniMax again with search context!
                        log.info("MiniMax re-invoking with web search results using model: '{}'", model);
                        return callChatRaw(requestMessages, model);
                    }
                }

                String content = extractMiniMaxContent(root);
                if (content == null || content.isBlank()) {
                    return buildEmptyMiniMaxMessage(root);
                }
                return content;
            }
        } catch (Exception e) {
            log.error("Minimax non-stream chat call failed: {}", e.getMessage(), e);
            return "问答失败: " + e.getMessage();
        }
    }

    private String callChatRaw(List<Map<String, Object>> requestMessages, String model) {
        return callChatRaw(requestMessages, model, 0.7);
    }

    private String callChatRaw(List<Map<String, Object>> requestMessages, String model, double temperature) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("model", model);
            payload.put("messages", requestMessages);
            payload.put("temperature", temperature);
            payload.put("max_tokens", 2048);

            Request request = new Request.Builder()
                    .url(chatEndpoint)
                    .addHeader("Authorization", "Bearer " + settingsService.apiKey("minimax"))
                    .addHeader("Content-Type", "application/json")
                    .post(RequestBody.create(objectMapper.writeValueAsString(payload), MediaType.parse("application/json")))
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                String raw = response.body() == null ? "" : response.body().string();
                if (!response.isSuccessful()) {
                    return "问答失败: " + response.code() + " - " + raw;
                }
                JsonNode root = objectMapper.readTree(raw);
                String content = extractMiniMaxContent(root);
                if (content == null || content.isBlank()) {
                    return buildEmptyMiniMaxMessage(root);
                }
                return content;
            }
        } catch (Exception e) {
            return "问答失败: " + e.getMessage();
        }
    }

    private String extractMiniMaxContent(JsonNode root) {
        return firstNonBlank(
                textAt(root, "/choices/0/message/content"),
                textAt(root, "/choices/0/message/reasoning_content"),
                textAt(root, "/choices/0/text"),
                textAt(root, "/reply"),
                textAt(root, "/data/reply"),
                textAt(root, "/data/text"),
                textAt(root, "/data/choices/0/message/content"),
                textAt(root, "/message/content"),
                textAt(root, "/content")
        );
    }

    private String textAt(JsonNode root, String pointer) {
        JsonNode node = root.at(pointer);
        if (node == null || node.isMissingNode() || node.isNull()) return "";
        if (node.isTextual()) return node.asText("").trim();
        if (node.isArray()) {
            List<String> parts = new ArrayList<>();
            for (JsonNode item : node) {
                String text = firstNonBlank(textAt(item, "/text"), textAt(item, "/content"));
                if (!text.isBlank()) parts.add(text);
            }
            return String.join("\n", parts).trim();
        }
        return node.asText("").trim();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) return value.trim();
        }
        return "";
    }

    private String buildEmptyMiniMaxMessage(JsonNode root) {
        String finishReason = textAt(root, "/choices/0/finish_reason");
        String baseStatus = textAt(root, "/base_resp/status_msg");
        String baseCode = textAt(root, "/base_resp/status_code");
        boolean inputSensitive = root.path("input_sensitive").asBoolean(false);
        boolean outputSensitive = root.path("output_sensitive").asBoolean(false);
        List<String> details = new ArrayList<>();
        if (!finishReason.isBlank()) details.add("finish_reason=" + finishReason);
        if (!baseCode.isBlank() && !"0".equals(baseCode)) details.add("status_code=" + baseCode);
        if (!baseStatus.isBlank()) details.add("status_msg=" + baseStatus);
        if (inputSensitive) details.add("input_sensitive=true");
        if (outputSensitive) details.add("output_sensitive=true");
        if (details.isEmpty()) return "模型返回为空，请重试。";
        return "模型返回为空（" + String.join("，", details) + "），请检查提示词、模型或 Key 配置。";
    }

    private String cleanPrompt(String prompt) {
        if (prompt == null) return "";
        String p = prompt.trim();
        p = p.replaceAll("^(?i)(帮我)?(生成|画|画一幅|画一张|画个|创建一个|创建一幅|设计|给我画|来一张|来一个|show me a|draw a|create an image of|generate a picture of)\\s*", "");
        p = p.replaceAll("(?i)(的)?(图片|图|图像|照片|画作|插画|壁纸|portrait|painting|picture|image|photo)$", "");
        return p.trim().isEmpty() ? prompt : p.trim();
    }

    private String generateImageFromPrompt(String prompt) {
        try {
            String cleanedPrompt = cleanPrompt(prompt);
            log.info("Original image prompt: '{}' -> Cleaned description for model: '{}'", prompt, cleanedPrompt);

            Map<String, Object> bodyMap = Map.of(
                    "model", "image-01",
                    "prompt", cleanedPrompt,
                    "response_format", "base64",
                    "aspect_ratio", "1:1",
                    "n", 1
            );
            Request httpRequest = new Request.Builder()
                    .url(imageGenerationEndpoint)
                    .addHeader("Authorization", "Bearer " + settingsService.apiKey("minimax"))
                    .post(RequestBody.create(objectMapper.writeValueAsString(bodyMap), MediaType.parse("application/json")))
                    .build();
            try (Response response = httpClient.newCall(httpRequest).execute()) {
                if (!response.isSuccessful() || response.body() == null) return null;
                String raw = response.body().string();
                JsonNode root = objectMapper.readTree(raw);
                String base64 = root.at("/data/image_base64/0").asText();
                if (base64 == null || base64.isEmpty()) return null;

                byte[] data = Base64.getDecoder().decode(base64);
                String ext = FileUtils.detectImageExtension(data);
                String filename = FileUtils.generateUniqueFilename(ext);
                Path baseDir = Paths.get(generatedImagesPath).toAbsolutePath();
                Files.createDirectories(baseDir);
                Files.write(baseDir.resolve(filename), data);

                String url = "/api/images/files/" + filename;
                try {
                    historyService.appendImage(prompt, filename, url, "image-01");
                } catch (Exception ex) {
                    log.warn("Failed to record image history: {}", ex.getMessage());
                }
                return url;
            }
        } catch (Exception e) {
            log.warn("generateImageFromPrompt failed for prompt '{}': {}", prompt, e.getMessage(), e);
            return null;
        }
    }

    private List<ChatMedia> extractMedia(String text) {
        List<ChatMedia> media = new ArrayList<>();
        Matcher imageMatcher = IMAGE_URL.matcher(text);
        while (imageMatcher.find()) {
            media.add(new ChatMedia("image", imageMatcher.group()));
        }
        Matcher audioMatcher = AUDIO_URL.matcher(text);
        while (audioMatcher.find()) {
            media.add(new ChatMedia("audio", audioMatcher.group()));
        }
        return media;
    }

    private void injectDateSnippetToLastUserMessage(List<Map<String, String>> messages) {
        for (int i = messages.size() - 1; i >= 0; i--) {
            Map<String, String> msg = messages.get(i);
            if ("user".equals(msg.get("role"))) {
                java.time.LocalDate now = java.time.LocalDate.now();
                String formattedDate = now.format(java.time.format.DateTimeFormatter.ofPattern("yyyy年MM月dd日"));
                String[] cnWeeks = {"", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"};
                String dayOfWeek = cnWeeks[now.getDayOfWeek().getValue()];
                String dateSnippet = "[当前系统时效环境]\n- 当前日期：" + formattedDate + " (" + dayOfWeek + ")\n- 当前年份：2026年\n请始终基于此系统时效环境为用户解答日期与时序相关的问题。\n\n";

                Map<String, String> mutableMsg = new HashMap<>(msg);
                mutableMsg.put("content", dateSnippet + msg.get("content"));
                messages.set(i, mutableMsg);
                break;
            }
        }
    }
}
