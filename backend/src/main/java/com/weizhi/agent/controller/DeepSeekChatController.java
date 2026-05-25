package com.weizhi.agent.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.weizhi.agent.model.ChatResponse;
import com.weizhi.agent.service.AiSettingsService;
import com.weizhi.agent.service.DeepSeekUsageService;
import com.weizhi.agent.service.MessageResolver;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/deepseek/chat")
public class DeepSeekChatController {
    private static final Logger log = LoggerFactory.getLogger(DeepSeekChatController.class);

    private final ObjectMapper objectMapper;
    private final OkHttpClient httpClient;
    private final DeepSeekUsageService usageService;
    private final AiSettingsService settingsService;

    public DeepSeekChatController(OkHttpClient okHttpClient, ObjectMapper objectMapper,
                                   DeepSeekUsageService usageService, AiSettingsService settingsService) {
        this.httpClient = okHttpClient;
        this.objectMapper = objectMapper;
        this.usageService = usageService;
        this.settingsService = settingsService;
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

        java.util.concurrent.CompletableFuture.runAsync(() -> {
            try {
                List<Map<String, String>> requestMessages = new ArrayList<>();
                requestMessages.add(Map.of("role", "system", "content", "你运行在 Weizhi Agent 的 DeepSeek 流式会话中。"));
                requestMessages.addAll(messages);

                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("model", model);
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
            List<Map<String, String>> requestMessages = new ArrayList<>();
            requestMessages.add(Map.of(
                    "role", "system",
                    "content", "你运行在 Weizhi Agent 的 DeepSeek 专属会话中。当前后端配置的 DeepSeek API 模型 ID 是 " + model + "。"
                            + "当用户询问你是什么模型、是否免费、底层模型或计费方式时，必须明确说明：这是 DeepSeek API 调用，不是免费无限服务；API 按 token 计费，费用由配置 API Key 的账户承担。"
                            + "不要声称 DeepSeek API 完全免费、无限使用或没有计费。"
            ));
            requestMessages.addAll(messages);

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("model", model);
            payload.put("messages", requestMessages);
            payload.put("temperature", 0.7);
            payload.put("max_tokens", 4096);
            payload.put("thinking", Map.of("type", "disabled"));

            Request request = new Request.Builder()
                    .url(baseUrl + "/chat/completions")
                    .addHeader("Authorization", "Bearer " + apiKey)
                    .addHeader("Content-Type", "application/json")
                    .post(RequestBody.create(objectMapper.writeValueAsString(payload), MediaType.parse("application/json")))
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                String raw = response.body() == null ? "" : response.body().string();
                if (!response.isSuccessful()) {
                    result.put("text", "DeepSeek 问答失败: " + response.code() + " - " + raw);
                    return result;
                }
                JsonNode root = objectMapper.readTree(raw);
                String content = root.path("choices").path(0).path("message").path("content").asText("");
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
}
