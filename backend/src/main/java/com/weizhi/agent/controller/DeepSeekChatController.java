package com.weizhi.agent.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.weizhi.agent.model.ChatResponse;
import com.weizhi.agent.service.AiSettingsService;
import com.weizhi.agent.service.DeepSeekUsageService;
import com.weizhi.agent.tools.SearchTools;
import com.weizhi.agent.service.MessageResolver;
import okhttp3.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.*;
@RestController
@RequestMapping("/api/deepseek/chat")
public class DeepSeekChatController {
    private static final Logger log = LoggerFactory.getLogger(DeepSeekChatController.class);

    private final ObjectMapper objectMapper;
    private final OkHttpClient httpClient;
    private final DeepSeekUsageService usageService;
    private final AiSettingsService settingsService;
    private final SearchTools searchTools;

    public DeepSeekChatController(OkHttpClient okHttpClient, ObjectMapper objectMapper,
                                   DeepSeekUsageService usageService, AiSettingsService settingsService,
                                   SearchTools searchTools) {
        this.httpClient = okHttpClient;
        this.objectMapper = objectMapper;
        this.usageService = usageService;
        this.settingsService = settingsService;
        this.searchTools = searchTools;
    }

    @PostMapping("/ask")
    public ChatResponse ask(@org.springframework.web.bind.annotation.RequestBody Map<String, Object> requestBody) {
        ChatResponse response = new ChatResponse();
        String apiKey = settingsService.apiKey("deepseek");
        if (apiKey == null || apiKey.isBlank()) {
            response.setText("DeepSeek API Key 未配置，请在 .env 或环境变量中设置 DEEPSEEK_API_KEY。");
            response.setMedia(new ArrayList<>());
            return response;
        }

        List<Map<String, String>> messages = MessageResolver.resolve(requestBody);
        if (messages.isEmpty()) {
            response.setText("请输入问题。");
            response.setMedia(new ArrayList<>());
            return response;
        }

        injectDateSnippetToLastUserMessage(messages);

        Map<String, Object> result = callDeepSeek(messages);
        response.setText(String.valueOf(result.getOrDefault("text", "DeepSeek 返回为空，请重试。")));
        response.setMedia(new ArrayList<>());
        response.setMetadata(result);
        return response;
    }

    @PostMapping(value = "/stream", produces = org.springframework.http.MediaType.TEXT_EVENT_STREAM_VALUE)
    public org.springframework.web.servlet.mvc.method.annotation.SseEmitter stream(@org.springframework.web.bind.annotation.RequestBody Map<String, Object> requestBody) {
        org.springframework.web.servlet.mvc.method.annotation.SseEmitter emitter = new org.springframework.web.servlet.mvc.method.annotation.SseEmitter(180000L);
        String apiKey = settingsService.apiKey("deepseek");
        String baseUrl = settingsService.deepSeekBaseUrl();
        String model = settingsService.model("deepseek");
        List<Map<String, String>> messages = MessageResolver.resolve(requestBody);

        if (messages.isEmpty() || apiKey == null || apiKey.isBlank()) {
            try {
                emitter.send("DeepSeek 未配置或输入为空");
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
                requestMessages.add(Map.of("role", "system", "content", "你运行在 Weizhi Agent 的 DeepSeek 流式会话中。" + dateSnippet));
                for (Map<String, String> msg : messages) {
                    requestMessages.add(new LinkedHashMap<>(msg));
                }

                String currentModel = model;
                boolean toolCalled = false;

                if (currentModel != null && !currentModel.contains("reasoner")) {
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
                                .url(baseUrl + "/chat/completions")
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
                                     boolean hasWebSearch = false;
                                     for (JsonNode toolCall : toolCallsNode) {
                                         if ("web_search".equals(toolCall.path("function").path("name").asText())) {
                                             hasWebSearch = true;
                                             break;
                                         }
                                     }

                                     if (hasWebSearch) {
                                         // Append Assistant tool call
                                         Map<String, Object> assistantMessage = new LinkedHashMap<>();
                                         assistantMessage.put("role", "assistant");
                                         assistantMessage.put("content", messageNode.path("content").asText(""));
                                         assistantMessage.put("tool_calls", objectMapper.convertValue(toolCallsNode, List.class));
                                         requestMessages.add(assistantMessage);

                                         // Loop and respond to each tool call
                                         for (JsonNode toolCall : toolCallsNode) {
                                             String callId = toolCall.path("id").asText();
                                             String functionName = toolCall.path("function").path("name").asText();
                                             String argumentsJson = toolCall.path("function").path("arguments").asText();

                                             if ("web_search".equals(functionName)) {
                                                 JsonNode argsNode = objectMapper.readTree(argumentsJson);
                                                 String query = argsNode.path("query").asText();
                                                 log.info("DeepSeek stream requested web_search for query: '{}'", query);

                                                 String searchContext = searchTools.search(query);

                                                 Map<String, Object> toolMessage = new LinkedHashMap<>();
                                                 toolMessage.put("role", "tool");
                                                 toolMessage.put("tool_call_id", callId);
                                                 toolMessage.put("name", "web_search");
                                                 toolMessage.put("content", searchContext);
                                                 requestMessages.add(toolMessage);
                                             } else {
                                                 Map<String, Object> toolMessage = new LinkedHashMap<>();
                                                 toolMessage.put("role", "tool");
                                                 toolMessage.put("tool_call_id", callId);
                                                 toolMessage.put("name", functionName);
                                                 toolMessage.put("content", "Success");
                                                 requestMessages.add(toolMessage);
                                             }
                                         }

                                         toolCalled = true;
                                     }
                                }
                            }
                        }
                    } catch (Exception e) {
                        log.warn("DeepSeek tool probe failed, falling back to normal streaming without tools: {}", e.getMessage());
                    }
                }

                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("model", currentModel);
                payload.put("messages", requestMessages);
                payload.put("temperature", 0.7);
                payload.put("stream", true);

                Request request = new Request.Builder()
                        .url(baseUrl + "/chat/completions")
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

    private Map<String, Object> callDeepSeek(List<Map<String, String>> messages) {
        Map<String, Object> result = new LinkedHashMap<>();
        try {
            String model = settingsService.model("deepseek");
            String apiKey = settingsService.apiKey("deepseek");
            String baseUrl = settingsService.deepSeekBaseUrl();
            java.time.LocalDate now = java.time.LocalDate.now();
            String formattedDate = now.format(java.time.format.DateTimeFormatter.ofPattern("yyyy年MM月dd日"));
            String[] cnWeeks = {"", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"};
            String dayOfWeek = cnWeeks[now.getDayOfWeek().getValue()];
            String dateSnippet = "\n\n[当前系统时效环境]\n- 当前日期：" + formattedDate + " (" + dayOfWeek + ")\n- 当前年份：2026年\n请始终基于此系统时效环境为用户解答日期与时序相关的问题。";

            List<Map<String, Object>> requestMessages = new ArrayList<>();
            requestMessages.add(Map.of(
                    "role", "system",
                    "content", "你运行在 Weizhi Agent 的 DeepSeek 专属会话中。当前后端配置的 DeepSeek API 模型 ID 是 " + model + "。"
                            + "当用户询问你是什么模型、是否免费、底层模型或计费方式时，必须明确说明：这是 DeepSeek API 调用，不是免费无限服务；API 按 token 计费，费用由配置 API Key 的账户承担。"
                            + "不要声称 DeepSeek API 完全免费、无限使用或没有计费。" + dateSnippet
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

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("model", model);
            payload.put("messages", requestMessages);
            payload.put("temperature", 0.7);
            payload.put("max_tokens", 4096);
            if (model != null && !model.contains("reasoner")) {
                payload.put("tools", tools);
            }
            if (model != null && model.contains("reasoner")) {
                payload.put("thinking", Map.of("type", "disabled"));
            }

            Request request = new Request.Builder()
                    .url(baseUrl + "/chat/completions")
                    .addHeader("Authorization", "Bearer " + apiKey)
                    .addHeader("Content-Type", "application/json")
                    .post(RequestBody.create(objectMapper.writeValueAsString(payload), MediaType.parse("application/json")))
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                String raw = response.body() == null ? "" : response.body().string();

                if (!response.isSuccessful() && payload.containsKey("tools")) {
                    log.warn("DeepSeek call with tools failed with status {}. Retrying without tools...", response.code());
                    payload.remove("tools");
                    Request retryRequest = new Request.Builder()
                            .url(baseUrl + "/chat/completions")
                            .addHeader("Authorization", "Bearer " + apiKey)
                            .addHeader("Content-Type", "application/json")
                            .post(RequestBody.create(objectMapper.writeValueAsString(payload), MediaType.parse("application/json")))
                            .build();
                    try (Response retryResponse = httpClient.newCall(retryRequest).execute()) {
                        raw = retryResponse.body() == null ? "" : retryResponse.body().string();
                        if (!retryResponse.isSuccessful()) {
                            result.put("text", "DeepSeek 问答失败: " + retryResponse.code() + " - " + raw);
                            return result;
                        }
                    }
                } else if (!response.isSuccessful()) {
                    result.put("text", "DeepSeek 问答失败: " + response.code() + " - " + raw);
                    return result;
                }

                JsonNode root = objectMapper.readTree(raw);
                JsonNode messageNode = root.path("choices").path(0).path("message");
                JsonNode toolCallsNode = messageNode.path("tool_calls");

                if (toolCallsNode != null && !toolCallsNode.isMissingNode() && toolCallsNode.size() > 0) {
                    boolean hasWebSearch = false;
                    for (JsonNode toolCall : toolCallsNode) {
                        if ("web_search".equals(toolCall.path("function").path("name").asText())) {
                            hasWebSearch = true;
                            break;
                        }
                    }

                    if (hasWebSearch) {
                        // 1. Append Assistant Message (containing tool_calls)
                        Map<String, Object> assistantMessage = new LinkedHashMap<>();
                        assistantMessage.put("role", "assistant");
                        assistantMessage.put("content", messageNode.path("content").asText(""));
                        assistantMessage.put("tool_calls", objectMapper.convertValue(toolCallsNode, List.class));
                        requestMessages.add(assistantMessage);

                        // 2. Loop through all tool calls and respond to them!
                        for (JsonNode toolCall : toolCallsNode) {
                            String callId = toolCall.path("id").asText();
                            String functionName = toolCall.path("function").path("name").asText();
                            String argumentsJson = toolCall.path("function").path("arguments").asText();

                            if ("web_search".equals(functionName)) {
                                JsonNode argsNode = objectMapper.readTree(argumentsJson);
                                String query = argsNode.path("query").asText();
                                log.info("DeepSeek requested web_search tool call for query: '{}'", query);

                                String searchContext = searchTools.search(query);

                                Map<String, Object> toolMessage = new LinkedHashMap<>();
                                toolMessage.put("role", "tool");
                                toolMessage.put("tool_call_id", callId);
                                toolMessage.put("name", "web_search");
                                toolMessage.put("content", searchContext);
                                requestMessages.add(toolMessage);
                            } else {
                                Map<String, Object> toolMessage = new LinkedHashMap<>();
                                toolMessage.put("role", "tool");
                                toolMessage.put("tool_call_id", callId);
                                toolMessage.put("name", functionName);
                                toolMessage.put("content", "Success");
                                requestMessages.add(toolMessage);
                            }
                        }

                        // 3. Call DeepSeek again with search context!
                        log.info("DeepSeek re-invoking with web search results using model: '{}'", model);
                        Map<String, Object> secondPayload = new LinkedHashMap<>();
                        secondPayload.put("model", model);
                        secondPayload.put("messages", requestMessages);
                        secondPayload.put("temperature", 0.7);
                        secondPayload.put("max_tokens", 4096);
                        if (model != null && model.contains("reasoner")) {
                            secondPayload.put("thinking", Map.of("type", "disabled"));
                        }

                        Request secondRequest = new Request.Builder()
                                .url(baseUrl + "/chat/completions")
                                .addHeader("Authorization", "Bearer " + apiKey)
                                .addHeader("Content-Type", "application/json")
                                .post(RequestBody.create(objectMapper.writeValueAsString(secondPayload), MediaType.parse("application/json")))
                                .build();

                        try (Response secondResponse = httpClient.newCall(secondRequest).execute()) {
                            String secondRaw = secondResponse.body() == null ? "" : secondResponse.body().string();
                            if (!secondResponse.isSuccessful()) {
                                throw new Exception("HTTP status " + secondResponse.code() + " during search follow-up: " + secondRaw);
                            }
                            JsonNode secondRoot = objectMapper.readTree(secondRaw);
                            JsonNode secondMessageNode = secondRoot.path("choices").path(0).path("message");
                            String content = secondMessageNode.path("content").asText("");

                            Map<String, Object> usage = objectMapper.convertValue(secondRoot.path("usage"), Map.class);
                            usageService.record(usage);
                            result.put("text", content);
                            result.put("provider", "deepseek");
                            result.put("model", model);
                            result.put("usage", usage);
                            result.put("localUsage", usageService.snapshot());
                            return result;
                        }
                    }
                }

                String content = messageNode.path("content").asText("");
                if (content == null || content.isBlank()) content = "DeepSeek 返回为空，请重试。";
                Map<String, Object> usage = objectMapper.convertValue(root.path("usage"), Map.class);
                usageService.record(usage);
                result.put("text", content);
                result.put("provider", "deepseek");
                result.put("model", model);
                result.put("usage", usage);
                result.put("localUsage", usageService.snapshot());
                return result;
            }
        } catch (Exception e) {
            log.error("DeepSeek chat call failed: {}", e.getMessage(), e);
            result.put("text", "DeepSeek 问答失败: " + e.getMessage());
            return result;
        }
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
