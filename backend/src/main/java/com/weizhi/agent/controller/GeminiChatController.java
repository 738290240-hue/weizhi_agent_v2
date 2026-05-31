package com.weizhi.agent.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.weizhi.agent.model.ChatMedia;
import com.weizhi.agent.model.ChatResponse;
import com.weizhi.agent.service.AiSettingsService;
import com.weizhi.agent.service.GeminiModelCapabilityService;
import com.weizhi.agent.service.HistoryService;
import com.weizhi.agent.service.MessageResolver;
import com.weizhi.agent.service.GeminiModelCapability;
import com.weizhi.agent.service.GeminiModelProbeService;
import com.weizhi.agent.service.GeminiRouteDecision;
import com.weizhi.agent.service.GeminiRoutingService;
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
@RequestMapping("/api/gemini/chat")
public class GeminiChatController {

    private static final Logger log = LoggerFactory.getLogger(GeminiChatController.class);

    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final AiSettingsService settingsService;
    private final HistoryService historyService;
    private final GeminiModelProbeService probeService;
    private final GeminiRoutingService routingService;
    private final SearchTools searchTools;

    @Value("${app.generated-images-path:generated_images}")
    private String generatedImagesPath;

    @Value("${gemini.image-model:" + GeminiModelCapabilityService.DEFAULT_IMAGE_MODEL + "}")
    private String defaultImageModel;

    private static final Pattern IMAGE_URL = Pattern.compile("!\\[.*?\\]\\((.*?)\\)|(/api/images/files/[A-Za-z0-9._-]+)");
    private static final Pattern DATA_IMAGE_URL = Pattern.compile("data:image/[^;]+;base64,([A-Za-z0-9+/=\\r\\n]+)");

    private final com.weizhi.agent.service.RagRetriever ragRetriever;

    public GeminiChatController(OkHttpClient okHttpClient, ObjectMapper objectMapper,
                                AiSettingsService settingsService, HistoryService historyService,
                                GeminiModelProbeService probeService, GeminiRoutingService routingService,
                                SearchTools searchTools, com.weizhi.agent.service.RagRetriever ragRetriever) {
        this.httpClient = okHttpClient;
        this.objectMapper = objectMapper;
        this.settingsService = settingsService;
        this.historyService = historyService;
        this.probeService = probeService;
        this.routingService = routingService;
        this.searchTools = searchTools;
        this.ragRetriever = ragRetriever;
    }

    @PostMapping("/ask")
    public ChatResponse ask(@org.springframework.web.bind.annotation.RequestBody Map<String, Object> requestBody) {
        ChatResponse response = new ChatResponse();
        String apiKey = settingsService.apiKey("gemini");
        String baseUrl = settingsService.geminiBaseUrl();
        List<Map<String, String>> messages = MessageResolver.resolve(requestBody);
        String latestUserMessage = latestUserMessage(messages);

        if (requestBody.containsKey("documentIds")) {
            List<String> documentIds = (List<String>) requestBody.get("documentIds");
            if (documentIds != null && !documentIds.isEmpty()) {
                List<com.weizhi.agent.model.DocumentChunk> matchedChunks = ragRetriever.retrieve(latestUserMessage, documentIds, 4);
                if (!matchedChunks.isEmpty()) {
                    StringBuilder sb = new StringBuilder();
                    sb.append("[本地知识库检索参考背景]:\n");
                    sb.append("--------------------------------------\n");
                    int idx = 1;
                    for (com.weizhi.agent.model.DocumentChunk chunk : matchedChunks) {
                        sb.append(idx).append(". ").append(chunk.getContent().trim()).append("\n\n");
                        idx++;
                    }
                    sb.append("--------------------------------------\n");
                    sb.append("请基于以上检索背景，并结合您自身的能力，回答以下用户的问题：\n");
                    sb.append(latestUserMessage);
                    String finalPrompt = sb.toString();

                    for (int i = messages.size() - 1; i >= 0; i--) {
                        Map<String, String> msg = messages.get(i);
                        if ("user".equals(msg.get("role"))) {
                            Map<String, String> mutableMsg = new HashMap<>(msg);
                            mutableMsg.put("content", finalPrompt);
                            messages.set(i, mutableMsg);
                            break;
                        }
                    }
                }
            }
        }

        if (messages.isEmpty()) {
            response.setText("请输入问题。");
            response.setMedia(new ArrayList<>());
            return response;
        }

        injectDateSnippetToLastUserMessage(messages);

        // Determine the model to use
        String model = null;
        if (requestBody.containsKey("model")) {
            String m = String.valueOf(requestBody.get("model")).trim();
            if (!m.isEmpty() && !"auto".equalsIgnoreCase(m)) {
                model = m;
            }
        }

        GeminiRouteDecision decision;
        if (model != null) {
            boolean isImage = model.toLowerCase().contains("image") || "image".equals(requestBody.get("mode"));
            decision = new GeminiRouteDecision(
                    isImage ? "image" : "text",
                    model,
                    "openai",
                    "用户指定模型：" + model,
                    null
            );
        } else {
            List<GeminiModelCapability> capabilities = probeService.getCapabilities().getModels();
            String requestedMode = String.valueOf(requestBody.getOrDefault("mode", "auto"));
            decision = routingService.route(latestUserMessage, requestedMode, capabilities);
        }

        Map<String, Object> result;
        if ("image".equals(decision.getMode())) {
            if (decision.getFallbackMessage() != null) {
                result = new LinkedHashMap<>();
                result.put("text", decision.getFallbackMessage());
                result.put("provider", "gemini");
                result.put("mode", "image");
                result.put("model", decision.getModel());
            } else {
                result = generateGeminiImage(latestUserMessage, apiKey, baseUrl, decision.getModel());
            }
        } else {
            result = callGemini(messages, decision.getModel(), apiKey, baseUrl);
        }

        response.setText(String.valueOf(result.getOrDefault("text", "Gemini 返回为空，请重试。")));
        response.setMedia(extractMedia(response.getText()));
        response.setMetadata(result);
        return response;
    }

    @PostMapping(value = "/stream", produces = org.springframework.http.MediaType.TEXT_EVENT_STREAM_VALUE)
    public org.springframework.web.servlet.mvc.method.annotation.SseEmitter stream(@org.springframework.web.bind.annotation.RequestBody Map<String, Object> requestBody) {
        org.springframework.web.servlet.mvc.method.annotation.SseEmitter emitter = new org.springframework.web.servlet.mvc.method.annotation.SseEmitter(180000L);
        String apiKey = settingsService.apiKey("gemini");
        String baseUrl = settingsService.geminiBaseUrl();
        List<Map<String, String>> messages = MessageResolver.resolve(requestBody);
        String latestUserMessage = latestUserMessage(messages);

        if (requestBody.containsKey("documentIds")) {
            List<String> documentIds = (List<String>) requestBody.get("documentIds");
            if (documentIds != null && !documentIds.isEmpty()) {
                List<com.weizhi.agent.model.DocumentChunk> matchedChunks = ragRetriever.retrieve(latestUserMessage, documentIds, 4);
                if (!matchedChunks.isEmpty()) {
                    StringBuilder sb = new StringBuilder();
                    sb.append("[本地知识库检索参考背景]:\n");
                    sb.append("--------------------------------------\n");
                    int idx = 1;
                    for (com.weizhi.agent.model.DocumentChunk chunk : matchedChunks) {
                        sb.append(idx).append(". ").append(chunk.getContent().trim()).append("\n\n");
                        idx++;
                    }
                    sb.append("--------------------------------------\n");
                    sb.append("请基于以上检索背景，并结合您自身的能力，回答以下用户的问题：\n");
                    sb.append(latestUserMessage);
                    String finalPrompt = sb.toString();

                    for (int i = messages.size() - 1; i >= 0; i--) {
                        Map<String, String> msg = messages.get(i);
                        if ("user".equals(msg.get("role"))) {
                            Map<String, String> mutableMsg = new HashMap<>(msg);
                            mutableMsg.put("content", finalPrompt);
                            messages.set(i, mutableMsg);
                            break;
                        }
                    }
                }
            }
        }

        if (messages.isEmpty()) {
            try {
                emitter.send("输入为空");
                emitter.complete();
            } catch (Exception ignored) {}
            return emitter;
        }

        injectDateSnippetToLastUserMessage(messages);

        // Determine the model to use
        String model = null;
        if (requestBody.containsKey("model")) {
            String m = String.valueOf(requestBody.get("model")).trim();
            if (!m.isEmpty() && !"auto".equalsIgnoreCase(m)) {
                model = m;
            }
        }

        GeminiRouteDecision decision;
        if (model != null) {
            boolean isImage = model.toLowerCase().contains("image") || "image".equals(requestBody.get("mode"));
            decision = new GeminiRouteDecision(
                    isImage ? "image" : "text",
                    model,
                    "openai",
                    "用户指定模型：" + model,
                    null
            );
        } else {
            List<GeminiModelCapability> capabilities = probeService.getCapabilities().getModels();
            String requestedMode = String.valueOf(requestBody.getOrDefault("mode", "auto"));
            decision = routingService.route(latestUserMessage, requestedMode, capabilities);
        }

        if ("image".equals(decision.getMode())) {
            java.util.concurrent.CompletableFuture.runAsync(() -> {
                try {
                    String text;
                    if (decision.getFallbackMessage() != null) {
                        text = decision.getFallbackMessage();
                    } else {
                        Map<String, Object> result = generateGeminiImage(latestUserMessage, apiKey, baseUrl, decision.getModel());
                        text = String.valueOf(result.getOrDefault("text", ""));
                    }
                    for (ChatMedia media : extractMedia(text)) {
                        emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter.event()
                                .name("media")
                                .data(objectMapper.writeValueAsString(Map.of("type", media.getType(), "url", media.getUrl()))));
                    }
                    if (!text.isBlank()) {
                        emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter.event()
                                .name("content")
                                .data(text));
                    }
                    emitter.complete();
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

        java.util.concurrent.CompletableFuture.runAsync(() -> {
            Set<String> triedModels = new LinkedHashSet<>();
            triedModels.add(decision.getModel());
            
            String currentModel = decision.getModel();
            int maxRetries = 3;
            
            for (int attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    java.time.LocalDate now = java.time.LocalDate.now();
                    String formattedDate = now.format(java.time.format.DateTimeFormatter.ofPattern("yyyy年MM月dd日"));
                    String[] cnWeeks = {"", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"};
                    String dayOfWeek = cnWeeks[now.getDayOfWeek().getValue()];
                    String dateSnippet = "\n\n[当前系统时效环境]\n- 当前日期：" + formattedDate + " (" + dayOfWeek + ")\n- 当前年份：2026年\n请始终基于此系统时效环境为用户解答日期与时序相关的问题。";

                    List<Map<String, Object>> requestMessages = new ArrayList<>();
                    requestMessages.add(Map.of(
                            "role", "system",
                            "content", "你运行在 Weizhi Agent 的 Gemini 流式会话中。当前路由的模型是 " + currentModel + "。" + dateSnippet
                    ));
                    for (Map<String, String> msg : messages) {
                        Map<String, Object> newMsg = new LinkedHashMap<>();
                        newMsg.put("role", msg.get("role"));
                        if ("user".equals(msg.get("role"))) {
                            newMsg.put("content", resolveMultimodalContent(msg.get("content")));
                        } else {
                            newMsg.put("content", msg.get("content"));
                        }
                        requestMessages.add(newMsg);
                    }

                    // Define web_search tool
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
                    Map<String, Object> probePayload = new LinkedHashMap<>();
                    probePayload.put("model", currentModel);
                    probePayload.put("messages", requestMessages);
                    probePayload.put("temperature", 0.7);
                    probePayload.put("max_tokens", 256);
                    probePayload.put("tools", tools);

                    Request.Builder probeRequestBuilder = new Request.Builder()
                            .url(baseUrl + "/chat/completions")
                            .addHeader("Content-Type", "application/json")
                            .post(RequestBody.create(objectMapper.writeValueAsString(probePayload), MediaType.parse("application/json")));

                    if (apiKey != null && !apiKey.isBlank()) {
                        probeRequestBuilder.addHeader("Authorization", "Bearer " + apiKey);
                    }

                    boolean toolCalled = false;
                    try {
                        try (Response probeResponse = httpClient.newCall(probeRequestBuilder.build()).execute()) {
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
                                        log.info("Gemini stream requested web_search for query: '{}'", query);

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
                        log.warn("Stream tool probe failed for model '{}': {}. Falling back to normal streaming.", currentModel, e.getMessage());
                    }

                    Map<String, Object> payload = new LinkedHashMap<>();
                    payload.put("model", currentModel);
                    payload.put("messages", requestMessages);
                    payload.put("temperature", 0.7);
                    payload.put("max_tokens", 4096);
                    payload.put("stream", true);

                    Request.Builder requestBuilder = new Request.Builder()
                            .url(baseUrl + "/chat/completions")
                            .addHeader("Content-Type", "application/json")
                            .post(RequestBody.create(objectMapper.writeValueAsString(payload), MediaType.parse("application/json")));

                    if (apiKey != null && !apiKey.isBlank()) {
                        requestBuilder.addHeader("Authorization", "Bearer " + apiKey);
                    }

                    Request request = requestBuilder.build();

                    try (Response response = httpClient.newCall(request).execute()) {
                        if (!response.isSuccessful()) {
                            String raw = response.body() == null ? "" : response.body().string();
                            throw new Exception("Stream payload failed with status " + response.code() + ": " + raw);
                        }
                        
                        if (response.body() == null) {
                            throw new Exception("Stream payload body is null");
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
                                    JsonNode deltaNode = chunk.path("choices").path(0).path("delta");
                                    String content = deltaNode.path("content").asText("");
                                    String reasoning = deltaNode.path("reasoning_content").asText("");
                                    
                                    if (!reasoning.isEmpty()) {
                                        emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter.event()
                                                .name("reasoning")
                                                .data(reasoning));
                                    } else if (!content.isEmpty()) {
                                        emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter.event()
                                                .name("content")
                                                .data(content));
                                    }
                                } catch (Exception ignored) {}
                            }
                        }
                        emitter.complete();
                        return; // Successfully streamed!
                    }
                } catch (Exception e) {
                    log.warn("Stream model '{}' failed on attempt {}: {}", currentModel, attempt, e.getMessage());
                    if (attempt < maxRetries) {
                        String fallback = findFallbackModel(currentModel, triedModels);
                        if (fallback != null) {
                            log.info("Stream triggering automatic failover: '{}' -> '{}'", currentModel, fallback);
                            currentModel = fallback;
                            triedModels.add(fallback);
                            continue; // Retry!
                        }
                    }
                    try {
                        emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter.event()
                                .name("error").data(e.getMessage()));
                        emitter.complete();
                    } catch (Exception ignored) {}
                    return;
                }
            }
            try {
                emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter.event()
                        .name("error").data("流式请求重试上限达到，请重试。"));
                emitter.complete();
            } catch (Exception ignored) {}
        });
        return emitter;
    }

    private Map<String, Object> callGemini(List<Map<String, String>> messages, String model, String apiKey, String baseUrl) {
        Set<String> triedModels = new LinkedHashSet<>();
        triedModels.add(model);
        
        String currentModel = model;
        int maxRetries = 3;
        
        for (int attempt = 0; attempt <= maxRetries; attempt++) {
            Map<String, Object> result = new LinkedHashMap<>();
            try {
                java.time.LocalDate now = java.time.LocalDate.now();
                String formattedDate = now.format(java.time.format.DateTimeFormatter.ofPattern("yyyy年MM月dd日"));
                String[] cnWeeks = {"", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"};
                String dayOfWeek = cnWeeks[now.getDayOfWeek().getValue()];
                String dateSnippet = "\n\n[当前系统时效环境]\n- 当前日期：" + formattedDate + " (" + dayOfWeek + ")\n- 当前年份：2026年\n请始终基于此系统时效环境为用户解答日期与时序相关的问题。";

                List<Map<String, Object>> requestMessages = new ArrayList<>();
                requestMessages.add(Map.of(
                        "role", "system",
                        "content", "你运行在 Weizhi Agent 的 Gemini 专属会话中。当前配置的模型是 " + currentModel + "。" + dateSnippet
                ));
                for (Map<String, String> msg : messages) {
                    Map<String, Object> newMsg = new LinkedHashMap<>();
                    newMsg.put("role", msg.get("role"));
                    if ("user".equals(msg.get("role"))) {
                        newMsg.put("content", resolveMultimodalContent(msg.get("content")));
                    } else {
                        newMsg.put("content", msg.get("content"));
                    }
                    requestMessages.add(newMsg);
                }

                // Define web_search tool
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

                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("model", currentModel);
                payload.put("messages", requestMessages);
                payload.put("temperature", 0.7);
                payload.put("max_tokens", 4096);
                payload.put("tools", tools);

                Request.Builder requestBuilder = new Request.Builder()
                        .url(baseUrl + "/chat/completions")
                        .addHeader("Content-Type", "application/json")
                        .post(RequestBody.create(objectMapper.writeValueAsString(payload), MediaType.parse("application/json")));

                if (apiKey != null && !apiKey.isBlank()) {
                    requestBuilder.addHeader("Authorization", "Bearer " + apiKey);
                }

                try (Response response = httpClient.newCall(requestBuilder.build()).execute()) {
                    String raw = response.body() == null ? "" : response.body().string();
                    if (!response.isSuccessful()) {
                        log.warn("Model '{}' failed with status code: {}. Raw error: {}", currentModel, response.code(), raw);
                        throw new Exception("HTTP status " + response.code() + ": " + raw);
                    }
                    
                    JsonNode root = objectMapper.readTree(raw);
                    JsonNode messageNode = root.path("choices").path(0).path("message");
                    JsonNode toolCallsNode = messageNode.path("tool_calls");

                    if (toolCallsNode != null && !toolCallsNode.isMissingNode() && toolCallsNode.size() > 0) {
                        // LLM decided to use the web_search tool!
                        JsonNode toolCall = toolCallsNode.get(0);
                        String callId = toolCall.path("id").asText();
                        String functionName = toolCall.path("function").path("name").asText();
                        String argumentsJson = toolCall.path("function").path("arguments").asText();

                        if ("web_search".equals(functionName)) {
                            JsonNode argsNode = objectMapper.readTree(argumentsJson);
                            String query = argsNode.path("query").asText();
                            log.info("Gemini requested web_search tool call for query: '{}'", query);

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

                            // 4. Call Gemini again with search context!
                            log.info("Gemini re-invoking with web search results using model: '{}'", currentModel);
                            Map<String, Object> secondPayload = new LinkedHashMap<>();
                            secondPayload.put("model", currentModel);
                            secondPayload.put("messages", requestMessages);
                            secondPayload.put("temperature", 0.7);
                            secondPayload.put("max_tokens", 4096);

                            Request.Builder secondRequestBuilder = new Request.Builder()
                                    .url(baseUrl + "/chat/completions")
                                    .addHeader("Content-Type", "application/json")
                                    .post(RequestBody.create(objectMapper.writeValueAsString(secondPayload), MediaType.parse("application/json")));

                            if (apiKey != null && !apiKey.isBlank()) {
                                secondRequestBuilder.addHeader("Authorization", "Bearer " + apiKey);
                            }

                            try (Response secondResponse = httpClient.newCall(secondRequestBuilder.build()).execute()) {
                                String secondRaw = secondResponse.body() == null ? "" : secondResponse.body().string();
                                if (!secondResponse.isSuccessful()) {
                                    throw new Exception("HTTP status " + secondResponse.code() + " during search follow-up: " + secondRaw);
                                }
                                JsonNode secondRoot = objectMapper.readTree(secondRaw);
                                JsonNode secondMessageNode = secondRoot.path("choices").path(0).path("message");
                                String content = secondMessageNode.path("content").asText("");
                                String reasoning = secondMessageNode.path("reasoning_content").asText("");

                                if (!reasoning.isEmpty() && (content == null || content.isBlank())) {
                                    content = "<think>\n" + reasoning + "\n</think>";
                                } else if (!reasoning.isEmpty()) {
                                    content = "<think>\n" + reasoning + "\n</think>\n\n" + content;
                                }

                                if (content == null || content.isBlank()) {
                                    content = "Gemini 联网问答返回为空，请重试。";
                                }

                                result.put("text", content);
                                result.put("provider", "gemini");
                                result.put("model", currentModel);
                                return result;
                            }
                        }
                    }

                    // Standard non-tool completions response
                    String content = messageNode.path("content").asText("");
                    String reasoning = messageNode.path("reasoning_content").asText("");

                    if (!reasoning.isEmpty() && (content == null || content.isBlank())) {
                        content = "<think>\n" + reasoning + "\n</think>";
                    } else if (!reasoning.isEmpty()) {
                        content = "<think>\n" + reasoning + "\n</think>\n\n" + content;
                    }

                    if (content == null || content.isBlank()) {
                        content = "Gemini 返回为空，请重试。";
                    }

                    result.put("text", content);
                    result.put("provider", "gemini");
                    result.put("model", currentModel);
                    return result;
                }
            } catch (Exception e) {
                log.warn("Gemini call for model '{}' failed on attempt {}: {}", currentModel, attempt, e.getMessage());
                if (attempt < maxRetries) {
                    String fallback = findFallbackModel(currentModel, triedModels);
                    if (fallback != null) {
                        log.info("Triggering automatic failover: '{}' -> '{}'", currentModel, fallback);
                        currentModel = fallback;
                        triedModels.add(fallback);
                        continue; // Retry with fallback model!
                    }
                }
                result.put("text", "Gemini 问答失败: " + e.getMessage());
                return result;
            }
        }
        Map<String, Object> finalResult = new LinkedHashMap<>();
        finalResult.put("text", "重试次数已达上限，所有候选模型均调用失败。");
        return finalResult;
    }

    private Map<String, Object> generateGeminiImage(String prompt, String apiKey, String baseUrl, String imageModel) {
        Map<String, Object> result = new LinkedHashMap<>();
        if (imageModel == null || imageModel.isBlank()) {
            imageModel = defaultImageModel == null || defaultImageModel.isBlank()
                    ? GeminiModelCapabilityService.DEFAULT_IMAGE_MODEL
                    : defaultImageModel;
        }
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("model", imageModel);
            payload.put("messages", List.of(Map.of("role", "user", "content", prompt)));
            payload.put("size", "1024x1024");

            Request.Builder requestBuilder = new Request.Builder()
                    .url(baseUrl + "/chat/completions")
                    .addHeader("Content-Type", "application/json")
                    .post(RequestBody.create(objectMapper.writeValueAsString(payload), MediaType.parse("application/json")));

            if (apiKey != null && !apiKey.isBlank()) {
                requestBuilder.addHeader("Authorization", "Bearer " + apiKey);
            }

            try (Response response = httpClient.newCall(requestBuilder.build()).execute()) {
                String raw = response.body() == null ? "" : response.body().string();
                if (!response.isSuccessful()) {
                    String message = response.code() == 502 && raw.contains("Requested entity was not found")
                            ? "Gemini 图片生成暂不可用：本地中转站列出了图片模型，但上游返回 404。请先确认中转站账号或图片模型接口是否可用。"
                            : "Gemini 图片生成失败: " + response.code() + " - " + summarize(raw);
                    result.put("text", message);
                    result.put("provider", "gemini");
                    result.put("mode", "image");
                    result.put("model", imageModel);
                    return result;
                }

                JsonNode root = objectMapper.readTree(raw);
                String base64 = firstImageBase64(root);
                if (base64 != null && !base64.isBlank()) {
                    String url = saveGeneratedImage(prompt, imageModel, base64);
                    result.put("text", "![Gemini 生成的图片](" + url + ")");
                    result.put("provider", "gemini");
                    result.put("mode", "image");
                    result.put("model", imageModel);
                    result.put("imageUrl", url);
                    return result;
                }

                String content = assistantContent(root);
                Matcher dataUrlMatcher = DATA_IMAGE_URL.matcher(content);
                if (dataUrlMatcher.find()) {
                    String url = saveGeneratedImage(prompt, imageModel, dataUrlMatcher.group(1));
                    content = dataUrlMatcher.replaceFirst(url);
                }
                if (content == null || content.isBlank()) {
                    content = "Gemini 图片生成失败：接口未返回图片内容。";
                }
                result.put("text", content);
                result.put("provider", "gemini");
                result.put("mode", "image");
                result.put("model", imageModel);
                return result;
            }
        } catch (Exception e) {
            log.error("Gemini image generation failed: {}", e.getMessage(), e);
            result.put("text", "Gemini 图片生成失败: " + e.getMessage());
            result.put("provider", "gemini");
            result.put("mode", "image");
            result.put("model", imageModel);
            return result;
        }
    }

    private String firstImageBase64(JsonNode root) {
        String b64 = root.at("/data/0/b64_json").asText("");
        if (!b64.isBlank()) return b64;
        b64 = root.at("/data/image_base64/0").asText("");
        if (!b64.isBlank()) return b64;
        b64 = root.at("/choices/0/message/images/0/image_url/url").asText("");
        if (b64.startsWith("data:image/")) {
            int commaIndex = b64.indexOf(',');
            if (commaIndex > -1) return b64.substring(commaIndex + 1);
        }
        String dataUrl = root.at("/data/0/url").asText("");
        if (dataUrl.startsWith("data:image/")) {
            int commaIndex = dataUrl.indexOf(',');
            if (commaIndex > -1) return dataUrl.substring(commaIndex + 1);
        }
        dataUrl = root.at("/data/0/image_url/url").asText("");
        if (dataUrl.startsWith("data:image/")) {
            int commaIndex = dataUrl.indexOf(',');
            if (commaIndex > -1) return dataUrl.substring(commaIndex + 1);
        }
        return "";
    }

    private String assistantContent(JsonNode root) {
        JsonNode contentNode = root.path("choices").path(0).path("message").path("content");
        if (contentNode.isTextual()) return contentNode.asText("");
        if (contentNode.isArray()) {
            StringBuilder content = new StringBuilder();
            for (JsonNode item : contentNode) {
                String text = item.path("text").asText("");
                if (!text.isBlank()) content.append(text);
                String imageUrl = item.path("image_url").path("url").asText("");
                if (!imageUrl.isBlank()) {
                    if (!content.isEmpty()) content.append("\n\n");
                    content.append("![Gemini 生成的图片](").append(imageUrl).append(")");
                }
            }
            return content.toString();
        }
        return "";
    }

    private String saveGeneratedImage(String prompt, String imageModel, String base64) throws Exception {
        byte[] data = Base64.getDecoder().decode(base64.replaceAll("\\s+", ""));
        String ext = FileUtils.detectImageExtension(data);
        String filename = FileUtils.generateUniqueFilename(ext);
        Path baseDir = Paths.get(generatedImagesPath).toAbsolutePath();
        Files.createDirectories(baseDir);
        Files.write(baseDir.resolve(filename), data);
        String url = "/api/images/files/" + filename;
        historyService.appendImage(prompt, filename, url, imageModel);
        return url;
    }

    private String latestUserMessage(List<Map<String, String>> messages) {
        for (int i = messages.size() - 1; i >= 0; i--) {
            Map<String, String> message = messages.get(i);
            if ("user".equals(message.get("role"))) {
                return message.getOrDefault("content", "");
            }
        }
        return "";
    }

    private List<ChatMedia> extractMedia(String text) {
        List<ChatMedia> media = new ArrayList<>();
        if (text == null) return media;

        // Extract images
        Matcher matcher = IMAGE_URL.matcher(text);
        while (matcher.find()) {
            String url = matcher.group(1) != null ? matcher.group(1) : matcher.group(2);
            if (url != null && !url.isBlank()) {
                media.add(new ChatMedia("image", url));
            }
        }

        // Extract audios
        Pattern audioPattern = Pattern.compile("(?:\\[.*?\\]\\()*(/api/tts/audio/[A-Za-z0-9._-]+)\\)*");
        Matcher audioMatcher = audioPattern.matcher(text);
        while (audioMatcher.find()) {
            String url = audioMatcher.group(1);
            if (url != null && !url.isBlank()) {
                media.add(new ChatMedia("audio", url));
            }
        }
        return media;
    }

    private String summarize(String raw) {
        if (raw == null || raw.isBlank()) return "";
        return raw.length() <= 300 ? raw : raw.substring(0, 300) + "...";
    }

    private Object resolveMultimodalContent(String content) {
        if (content == null) return "";

        List<Map<String, Object>> contents = new ArrayList<>();
        // Extract images
        Matcher imgMatcher = IMAGE_URL.matcher(content);
        List<String> foundImages = new ArrayList<>();
        while (imgMatcher.find()) {
            String path = imgMatcher.group(1) != null ? imgMatcher.group(1) : imgMatcher.group(2);
            if (path != null && path.contains("/api/images/files/")) {
                foundImages.add(path);
            }
        }

        // Extract audios
        Pattern audioPattern = Pattern.compile("(?:\\[.*?\\]\\()*(/api/tts/audio/[A-Za-z0-9._-]+)\\)*");
        Matcher audioMatcher = audioPattern.matcher(content);
        List<String> foundAudios = new ArrayList<>();
        while (audioMatcher.find()) {
            foundAudios.add(audioMatcher.group(1));
        }

        // If no images and no audios, return as plain string
        if (foundImages.isEmpty() && foundAudios.isEmpty()) {
            return content;
        }

        // Clean text by removing raw file paths and markdown elements
        String cleanText = content.replaceAll("!\\\\[.*?\\\\]\\\\(.*?\\\\)", "")
                .replaceAll("\\[语音\\]\\\\(/api/tts/audio/.*?\\\\)", "")
                .replaceAll("/api/images/files/[A-Za-z0-9._-]+", "")
                .replaceAll("/api/tts/audio/[A-Za-z0-9._-]+", "")
                .trim();
        if (cleanText.isEmpty()) {
            cleanText = "请分析以下多模态输入。";
        }
        contents.add(Map.of("type", "text", "text", cleanText));

        // Add images as base64 data urls
        for (String imgUrl : foundImages) {
            String filename = imgUrl.substring(imgUrl.lastIndexOf('/') + 1);
            try {
                Path path = Paths.get(generatedImagesPath).resolve(filename).toAbsolutePath();
                if (Files.exists(path)) {
                    byte[] bytes = Files.readAllBytes(path);
                    String base64 = Base64.getEncoder().encodeToString(bytes);
                    String mimeType = Files.probeContentType(path);
                    if (mimeType == null) mimeType = "image/png";

                    contents.add(Map.of(
                            "type", "image_url",
                            "image_url", Map.of("url", "data:" + mimeType + ";base64," + base64)
                    ));
                }
            } catch (Exception e) {
                log.error("Failed to read and inline image {}: {}", filename, e.getMessage());
            }
        }

        // Add audios as base64 input_audio elements
        for (String audioUrl : foundAudios) {
            String filename = audioUrl.substring(audioUrl.lastIndexOf('/') + 1);
            try {
                Path path = Paths.get("generated_audio").resolve(filename).toAbsolutePath();
                if (Files.exists(path)) {
                    byte[] bytes = Files.readAllBytes(path);
                    String base64 = Base64.getEncoder().encodeToString(bytes);
                    String ext = filename.substring(filename.lastIndexOf('.') + 1);

                    contents.add(Map.of(
                            "type", "input_audio",
                            "input_audio", Map.of("data", base64, "format", ext)
                    ));
                }
            } catch (Exception e) {
                log.error("Failed to read and inline audio {}: {}", filename, e.getMessage());
            }
        }

        return contents;
    }

    private String findFallbackModel(String failedModel, Set<String> triedModels) {
        List<GeminiModelCapability> capabilities = probeService.getCapabilities().getModels();
        
        // 1. Try to find another model in the same group that is available and hasn't been tried yet
        String failedGroup = null;
        for (GeminiModelCapability c : capabilities) {
            if (c.getId().equals(failedModel)) {
                failedGroup = c.getGroup();
                break;
            }
        }
        
        if (failedGroup != null) {
            for (GeminiModelCapability c : capabilities) {
                if (c.isAvailable() && failedGroup.equals(c.getGroup()) && !triedModels.contains(c.getId())) {
                    return c.getId();
                }
            }
        }
        
        // 2. Try to find any available model that hasn't been tried yet
        for (GeminiModelCapability c : capabilities) {
            if (c.isAvailable() && !triedModels.contains(c.getId())) {
                return c.getId();
            }
        }
        
        // 3. Fallback to default chat model if not tried yet
        String defaultModel = GeminiModelCapabilityService.DEFAULT_CHAT_MODEL;
        if (!triedModels.contains(defaultModel)) {
            return defaultModel;
        }
        
        return null;
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
