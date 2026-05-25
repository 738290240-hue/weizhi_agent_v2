package com.weizhi.agent.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.weizhi.agent.model.ChatMedia;
import com.weizhi.agent.model.ChatResponse;
import com.weizhi.agent.service.AiSettingsService;
import com.weizhi.agent.service.MessageResolver;
import com.weizhi.agent.tools.FileUtils;
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
@RequestMapping("/api/openai/chat")
public class OpenAiChatController {

    private static final Logger log = LoggerFactory.getLogger(OpenAiChatController.class);

    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final AiSettingsService settingsService;

    @Value("${app.generated-images-path:generated_images}")
    private String generatedImagesPath;

    private static final Pattern IMAGE_URL = Pattern.compile("!\\[.*?\\]\\((.*?)\\)");


    public OpenAiChatController(OkHttpClient okHttpClient, ObjectMapper objectMapper,
                                AiSettingsService settingsService) {
        this.httpClient = okHttpClient;
        this.objectMapper = objectMapper;
        this.settingsService = settingsService;
    }

    @PostMapping("/ask")
    public ChatResponse ask(@org.springframework.web.bind.annotation.RequestBody Map<String, Object> requestBody) {
        ChatResponse response = new ChatResponse();
        String apiKey = settingsService.apiKey("openai");
        if (apiKey == null || apiKey.isBlank()) {
            response.setText("OpenAI API Key 未配置，请在设置面板或环境变量中配置。");
            response.setMedia(new ArrayList<>());
            return response;
        }

        List<Map<String, String>> messages = MessageResolver.resolve(requestBody);
        if (messages.isEmpty()) {
            response.setText("请输入问题。");
            response.setMedia(new ArrayList<>());
            return response;
        }

        Map<String, Object> result = callOpenAi(messages);
        response.setText(String.valueOf(result.getOrDefault("text", "OpenAI 返回为空，请重试。")));
        response.setMedia(extractMedia(response.getText()));
        response.setMetadata(result);
        return response;
    }

    @PostMapping(value = "/stream", produces = org.springframework.http.MediaType.TEXT_EVENT_STREAM_VALUE)
    public org.springframework.web.servlet.mvc.method.annotation.SseEmitter stream(@org.springframework.web.bind.annotation.RequestBody Map<String, Object> requestBody) {
        org.springframework.web.servlet.mvc.method.annotation.SseEmitter emitter = new org.springframework.web.servlet.mvc.method.annotation.SseEmitter(180000L);
        String apiKey = settingsService.apiKey("openai");
        String baseUrl = settingsService.openAiBaseUrl();
        String model = settingsService.model("openai");
        List<Map<String, String>> messages = MessageResolver.resolve(requestBody);

        if (messages.isEmpty() || apiKey == null || apiKey.isBlank()) {
            try {
                emitter.send("OpenAI 未配置或输入为空");
                emitter.complete();
            } catch (Exception ignored) {}
            return emitter;
        }

        java.util.concurrent.CompletableFuture.runAsync(() -> {
            try {
                List<Map<String, String>> requestMessages = new ArrayList<>();
                requestMessages.add(Map.of("role", "system", "content", "你运行在 Weizhi Agent 的 OpenAI 流式会话中。"));
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

    private Map<String, Object> callOpenAi(List<Map<String, String>> messages) {
        Map<String, Object> result = new LinkedHashMap<>();
        try {
            String model = settingsService.model("openai");
            String apiKey = settingsService.apiKey("openai");
            String baseUrl = settingsService.openAiBaseUrl();
            List<Map<String, String>> requestMessages = new ArrayList<>();
            requestMessages.add(Map.of(
                    "role", "system",
                    "content", "你运行在 Weizhi Agent 的 OpenAI 专属会话中。当前配置的模型是 " + model + "。"
            ));
            requestMessages.addAll(messages);

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("model", model);
            payload.put("messages", requestMessages);
            payload.put("temperature", 0.7);
            
            if (!model.startsWith("o1")) {
                payload.put("max_tokens", 4096);
            }

            // Function calling for image generation (Standard OpenAI)
            List<Map<String, Object>> tools = new ArrayList<>();
            Map<String, Object> generateImageTool = new LinkedHashMap<>();
            generateImageTool.put("type", "function");
            
            Map<String, Object> functionDef = new LinkedHashMap<>();
            functionDef.put("name", "generate_image");
            functionDef.put("description", "Generate an image based on the user's description. Call this ONLY when the user explicitly requests to draw a picture, create an image, or design a poster.");
            
            Map<String, Object> parameters = new LinkedHashMap<>();
            parameters.put("type", "object");
            parameters.put("properties", Map.of(
                "prompt", Map.of(
                    "type", "string",
                    "description", "The detailed English prompt for image generation. Translate and expand the user's request into a high-quality DALL-E prompt."
                )
            ));
            parameters.put("required", List.of("prompt"));
            functionDef.put("parameters", parameters);
            generateImageTool.put("function", functionDef);
            tools.add(generateImageTool);
            
            payload.put("tools", tools);

            Request request = new Request.Builder()
                    .url(baseUrl + "/chat/completions")
                    .addHeader("Authorization", "Bearer " + apiKey)
                    .addHeader("Content-Type", "application/json")
                    .post(RequestBody.create(objectMapper.writeValueAsString(payload), MediaType.parse("application/json")))
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                String raw = response.body() == null ? "" : response.body().string();
                if (!response.isSuccessful()) {
                    result.put("text", "OpenAI 问答失败: " + response.code() + " - " + raw);
                    return result;
                }
                JsonNode root = objectMapper.readTree(raw);
                JsonNode messageNode = root.path("choices").path(0).path("message");
                
                // 1. Handle non-standard proxy behavior: 'images' array directly in assistant message (e.g., api.shqbb.com)
                if (messageNode.has("images") && messageNode.path("images").isArray() && messageNode.path("images").size() > 0) {
                    JsonNode imagesNode = messageNode.path("images");
                    for (JsonNode imgNode : imagesNode) {
                        String b64DataUrl = imgNode.path("image_url").path("url").asText("");
                        if (b64DataUrl.startsWith("data:image/")) {
                            int commaIdx = b64DataUrl.indexOf(',');
                            if (commaIdx > 0) {
                                String base64 = b64DataUrl.substring(commaIdx + 1);
                                try {
                                    byte[] data = Base64.getDecoder().decode(base64.replaceAll("\\s+", ""));
                                    String ext = FileUtils.detectImageExtension(data);
                                    String filename = FileUtils.generateUniqueFilename(ext);
                                    Path baseDir = Paths.get(generatedImagesPath).toAbsolutePath();
                                    Files.createDirectories(baseDir);
                                    Files.write(baseDir.resolve(filename), data);
                                    String url = "/api/images/files/" + filename;
                                    
                                    log.info("Proxy non-standard image hijacking detected. Saved image: {}", url);
                                    result.put("text", "![生成的图片](" + url + ")");
                                    result.put("provider", "openai");
                                    result.put("model", model);
                                    return result;
                                } catch (Exception e) {
                                    log.warn("Failed to decode base64 from non-standard proxy images array", e);
                                }
                            }
                        }
                    }
                }

                // 2. Handle standard OpenAI tool calls
                if (messageNode.has("tool_calls") && !messageNode.path("tool_calls").isNull()) {
                    JsonNode toolCalls = messageNode.path("tool_calls");
                    for (JsonNode toolCall : toolCalls) {
                        String functionName = toolCall.path("function").path("name").asText("");
                        if ("generate_image".equals(functionName)) {
                            String arguments = toolCall.path("function").path("arguments").asText("{}");
                            JsonNode argsNode = objectMapper.readTree(arguments);
                            String prompt = argsNode.path("prompt").asText("");
                            
                            log.info("OpenAI Function Calling triggered: generate_image with prompt: {}", prompt);
                            String url = generateOpenAiImageFromPrompt(prompt);
                            String content = url != null ? "![生成的图片](" + url + ")" : "图片生成失败，请稍后重试。";
                            
                            result.put("text", content);
                            result.put("provider", "openai");
                            result.put("model", model);
                            return result;
                        }
                    }
                }

                // 2.5 Handle legacy OpenAI function_call (some proxies return this instead of tool_calls)
                if (messageNode.has("function_call") && !messageNode.path("function_call").isNull()) {
                    JsonNode functionCall = messageNode.path("function_call");
                    String functionName = functionCall.path("name").asText("");
                    if ("generate_image".equals(functionName)) {
                        String arguments = functionCall.path("arguments").asText("{}");
                        JsonNode argsNode = objectMapper.readTree(arguments);
                        String prompt = argsNode.path("prompt").asText("");
                        
                        log.info("OpenAI Legacy Function Calling triggered: generate_image with prompt: {}", prompt);
                        String url = generateOpenAiImageFromPrompt(prompt);
                        String content = url != null ? "![生成的图片](" + url + ")" : "图片生成失败，请稍后重试。";
                        
                        result.put("text", content);
                        result.put("provider", "openai");
                        result.put("model", model);
                        return result;
                    }
                }

                // 3. Handle standard text response
                String content = messageNode.path("content").asText("");
                if (content == null || content.isBlank() || "null".equals(content)) {
                    content = "OpenAI 返回为空，请重试。";
                }
                
                @SuppressWarnings("unchecked")
                Map<String, Object> usage = objectMapper.convertValue(root.path("usage"), Map.class);
                
                result.put("text", content);
                result.put("provider", "openai");
                result.put("model", model);
                if (usage != null) {
                    result.put("usage", usage);
                }
                return result;
            }
        } catch (Exception e) {
            log.error("OpenAI chat call failed: {}", e.getMessage(), e);
            result.put("text", "OpenAI 问答失败: " + e.getMessage());
            return result;
        }
    }

    private List<ChatMedia> extractMedia(String text) {
        List<ChatMedia> media = new ArrayList<>();
        if (text == null) return media;
        Matcher imageMatcher = IMAGE_URL.matcher(text);
        while (imageMatcher.find()) {
            media.add(new ChatMedia("image", imageMatcher.group(1)));
        }
        return media;
    }

    private String generateOpenAiImageFromPrompt(String prompt) {
        try {
            String apiKey = settingsService.apiKey("openai");
            String baseUrl = settingsService.openAiBaseUrl();
            
            Map<String, Object> bodyMap = Map.of(
                    "model", "gpt-image-2",
                    "prompt", prompt,
                    "response_format", "b64_json",
                    "n", 1,
                    "size", "1024x1024"
            );
            Request httpRequest = new Request.Builder()
                    .url(baseUrl + "/images/generations")
                    .addHeader("Authorization", "Bearer " + apiKey)
                    .addHeader("Content-Type", "application/json")
                    .post(RequestBody.create(objectMapper.writeValueAsString(bodyMap), MediaType.parse("application/json")))
                    .build();

            try (Response response = httpClient.newCall(httpRequest).execute()) {
                if (!response.isSuccessful() || response.body() == null) {
                    log.error("OpenAI image generation failed: {}", response.body() != null ? response.body().string() : "Empty body");
                    return null;
                }
                String raw = response.body().string();
                JsonNode root = objectMapper.readTree(raw);
                String base64 = root.at("/data/0/b64_json").asText();
                if (base64 == null || base64.isEmpty()) return null;

                byte[] data = Base64.getDecoder().decode(base64.replaceAll("\\s+", ""));
                String ext = FileUtils.detectImageExtension(data);
                String filename = FileUtils.generateUniqueFilename(ext);
                Path baseDir = Paths.get(generatedImagesPath).toAbsolutePath();
                Files.createDirectories(baseDir);
                Files.write(baseDir.resolve(filename), data);
                return "/api/images/files/" + filename;
            }
        } catch (Exception e) {
            log.warn("generateOpenAiImageFromPrompt failed for prompt '{}': {}", prompt, e.getMessage(), e);
            return null;
        }
    }
}
