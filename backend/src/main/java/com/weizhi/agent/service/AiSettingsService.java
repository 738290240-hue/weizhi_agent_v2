package com.weizhi.agent.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.weizhi.agent.data.SettingsStore;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class AiSettingsService {
    private static final Logger log = LoggerFactory.getLogger(AiSettingsService.class);

    private final SettingsStore settingsStore;
    private final ObjectMapper objectMapper;
    private final OkHttpClient httpClient;

    @Value("${MINIMAX_API_KEY:}")
    private String defaultMiniMaxKey;

    @Value("${minimax.model:MiniMax-M2.7}")
    private String defaultMiniMaxModel;

    @Value("${deepseek.api-key:${DEEPSEEK_API_KEY:}}")
    private String defaultDeepSeekKey;

    @Value("${deepseek.base-url:https://api.deepseek.com}")
    private String defaultDeepSeekBaseUrl;

    @Value("${deepseek.model:deepseek-v4-flash}")
    private String defaultDeepSeekModel;

    @Value("${openai.api-key:${OPENAI_API_KEY:}}")
    private String defaultOpenAiKey;

    @Value("${openai.base-url:https://api.openai.com/v1}")
    private String defaultOpenAiBaseUrl;

    @Value("${openai.model:gpt-4o}")
    private String defaultOpenAiModel;

    @Value("${gemini.api-key:${GEMINI_API_KEY:}}")
    private String defaultGeminiKey;

    @Value("${gemini.base-url:http://127.0.0.1:8045/v1}")
    private String defaultGeminiBaseUrl;

    @Value("${gemini.model:" + GeminiModelCapabilityService.DEFAULT_CHAT_MODEL + "}")
    private String defaultGeminiModel;

    public AiSettingsService(SettingsStore settingsStore, ObjectMapper objectMapper, OkHttpClient okHttpClient) {
        this.settingsStore = settingsStore;
        this.objectMapper = objectMapper;
        this.httpClient = okHttpClient;
    }

    public synchronized Map<String, Object> getSettings() {
        Map<String, Object> stored = settingsStore.readStored();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("minimax", providerView("minimax", stored));
        result.put("deepseek", providerView("deepseek", stored));
        result.put("openai", providerView("openai", stored));
        result.put("gemini", providerView("gemini", stored));
        return result;
    }

    public synchronized Map<String, Object> updateProvider(String provider, Map<String, Object> payload) {
        Map<String, Object> stored = settingsStore.readStored();
        Map<String, Object> providerSettings = providerSettings(provider, stored);
        if (payload.containsKey("apiKey")) {
            String apiKey = String.valueOf(payload.getOrDefault("apiKey", "")).trim();
            if (!apiKey.isEmpty()) providerSettings.put("apiKey", apiKey);
        }
        if (payload.containsKey("model")) {
            String model = String.valueOf(payload.getOrDefault("model", "")).trim();
            if (!model.isEmpty()) providerSettings.put("model", model);
        }
        if (payload.containsKey("baseUrl")) {
            String baseUrl = String.valueOf(payload.getOrDefault("baseUrl", "")).trim();
            if (!baseUrl.isEmpty()) providerSettings.put("baseUrl", baseUrl);
        }
        stored.put(provider, providerSettings);
        settingsStore.writeStored(stored);
        return providerView(provider, stored);
    }

    public String apiKey(String provider) {
        Map<String, Object> stored = settingsStore.readStored();
        Object configured = providerSettings(provider, stored).get("apiKey");
        String value = configured == null ? "" : String.valueOf(configured);
        if (!value.isBlank()) return value;
        if ("deepseek".equals(provider)) return defaultDeepSeekKey == null ? "" : defaultDeepSeekKey;
        if ("openai".equals(provider)) return defaultOpenAiKey == null ? "" : defaultOpenAiKey;
        if ("gemini".equals(provider)) return defaultGeminiKey == null ? "" : defaultGeminiKey;
        return defaultMiniMaxKey == null ? "" : defaultMiniMaxKey;
    }

    public String model(String provider) {
        Map<String, Object> stored = settingsStore.readStored();
        Object configured = providerSettings(provider, stored).get("model");
        String value = configured == null ? "" : String.valueOf(configured);
        if (!value.isBlank()) return value;
        if ("deepseek".equals(provider)) return defaultDeepSeekModel;
        if ("openai".equals(provider)) return defaultOpenAiModel;
        if ("gemini".equals(provider)) return defaultGeminiModel;
        return defaultMiniMaxModel;
    }

    public String deepSeekBaseUrl() {
        return defaultDeepSeekBaseUrl;
    }

    public String openAiBaseUrl() {
        Map<String, Object> stored = settingsStore.readStored();
        Object configured = providerSettings("openai", stored).get("baseUrl");
        String value = configured == null ? "" : String.valueOf(configured);
        if (!value.isBlank()) return value;
        return defaultOpenAiBaseUrl;
    }

    public String geminiBaseUrl() {
        Map<String, Object> stored = settingsStore.readStored();
        Object configured = providerSettings("gemini", stored).get("baseUrl");
        String value = configured == null ? "" : String.valueOf(configured);
        if (!value.isBlank()) return value;
        return defaultGeminiBaseUrl;
    }

    public List<Map<String, Object>> models(String provider) {
        if ("deepseek".equals(provider)) return deepSeekModels();
        if ("openai".equals(provider)) return openAiModels();
        if ("gemini".equals(provider)) return geminiModels();
        return List.of(
                modelInfo("MiniMax-M2.7", "MiniMax M2.7"),
                modelInfo("MiniMax-M2.5", "MiniMax M2.5"),
                modelInfo("MiniMax-M2.1", "MiniMax M2.1"),
                modelInfo("MiniMax-M2", "MiniMax M2")
        );
    }

    private List<Map<String, Object>> deepSeekModels() {
        String key = apiKey("deepseek");
        if (key.isBlank()) {
            return fallbackDeepSeekModels();
        }
        Request request = new Request.Builder()
                .url(defaultDeepSeekBaseUrl + "/models")
                .addHeader("Authorization", "Bearer " + key)
                .get()
                .build();
        OkHttpClient clientWithTimeout = httpClient.newBuilder()
                .connectTimeout(3, java.util.concurrent.TimeUnit.SECONDS)
                .readTimeout(3, java.util.concurrent.TimeUnit.SECONDS)
                .build();
        try (Response response = clientWithTimeout.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) return fallbackDeepSeekModels();
            Map<String, Object> root = objectMapper.readValue(response.body().string(), new TypeReference<Map<String, Object>>() {});
            Object data = root.get("data");
            if (!(data instanceof List<?> list)) return fallbackDeepSeekModels();
            List<Map<String, Object>> models = new ArrayList<>();
            for (Object item : list) {
                if (item instanceof Map<?, ?> map && map.get("id") != null) {
                    String id = String.valueOf(map.get("id"));
                    models.add(modelInfo(id, id));
                }
            }
            return models.isEmpty() ? fallbackDeepSeekModels() : models;
        } catch (Exception e) {
            log.warn("Failed to fetch DeepSeek models from API, using fallback list: {}", e.getMessage());
            return fallbackDeepSeekModels();
        }
    }

    private List<Map<String, Object>> fallbackDeepSeekModels() {
        return List.of(
                modelInfo("deepseek-v4-flash", "DeepSeek V4 Flash"),
                modelInfo("deepseek-v4-pro", "DeepSeek V4 Pro"),
                modelInfo("deepseek-chat", "DeepSeek Chat"),
                modelInfo("deepseek-reasoner", "DeepSeek Reasoner")
        );
    }

    private List<Map<String, Object>> openAiModels() {
        String key = apiKey("openai");
        String baseUrl = openAiBaseUrl();
        if (key.isBlank()) {
            return fallbackOpenAiModels();
        }
        Request request = new Request.Builder()
                .url(baseUrl + "/models")
                .addHeader("Authorization", "Bearer " + key)
                .get()
                .build();
        OkHttpClient clientWithTimeout = httpClient.newBuilder()
                .connectTimeout(3, java.util.concurrent.TimeUnit.SECONDS)
                .readTimeout(3, java.util.concurrent.TimeUnit.SECONDS)
                .build();
        try (Response response = clientWithTimeout.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) return fallbackOpenAiModels();
            Map<String, Object> root = objectMapper.readValue(response.body().string(), new TypeReference<Map<String, Object>>() {});
            Object data = root.get("data");
            if (!(data instanceof List<?> list)) return fallbackOpenAiModels();
            List<Map<String, Object>> models = new ArrayList<>();
            for (Object item : list) {
                if (item instanceof Map<?, ?> map && map.get("id") != null) {
                    String id = String.valueOf(map.get("id"));
                    // Include most standard chat models
                    if (id.contains("gpt") || id.contains("o1") || id.contains("claude") || id.contains("deepseek")) {
                        models.add(modelInfo(id, id));
                    }
                }
            }
            if (models.isEmpty()) {
                // If filter fails, return at least 30 to not be empty
                for (int i = 0; i < Math.min(30, list.size()); i++) {
                    if (list.get(i) instanceof Map<?, ?> map && map.get("id") != null) {
                        String id = String.valueOf(map.get("id"));
                        models.add(modelInfo(id, id));
                    }
                }
            }
            return models.isEmpty() ? fallbackOpenAiModels() : models;
        } catch (Exception e) {
            log.warn("Failed to fetch OpenAI models from API: {}", e.getMessage());
            return fallbackOpenAiModels();
        }
    }

    private List<Map<String, Object>> fallbackOpenAiModels() {
        return List.of(
                modelInfo("gpt-4o", "GPT-4o"),
                modelInfo("gpt-4o-mini", "GPT-4o-Mini"),
                modelInfo("o1-preview", "o1 Preview"),
                modelInfo("o1-mini", "o1 Mini"),
                modelInfo("gpt-3.5-turbo", "GPT-3.5 Turbo")
        );
    }

    private List<Map<String, Object>> geminiModels() {
        String key = apiKey("gemini");
        String baseUrl = geminiBaseUrl();
        Request.Builder requestBuilder = new Request.Builder()
                .url(baseUrl + "/models")
                .get();
        if (key != null && !key.isBlank()) {
            requestBuilder.addHeader("Authorization", "Bearer " + key);
        }
        Request request = requestBuilder.build();
        OkHttpClient clientWithTimeout = httpClient.newBuilder()
                .connectTimeout(3, java.util.concurrent.TimeUnit.SECONDS)
                .readTimeout(3, java.util.concurrent.TimeUnit.SECONDS)
                .build();
        try (Response response = clientWithTimeout.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) return fallbackGeminiModels();
            Map<String, Object> root = objectMapper.readValue(response.body().string(), new TypeReference<Map<String, Object>>() {});
            Object data = root.get("data");
            if (!(data instanceof List<?> list)) return fallbackGeminiModels();
            List<Map<String, Object>> models = new ArrayList<>();
            for (Object item : list) {
                if (item instanceof Map<?, ?> map && map.get("id") != null) {
                    String id = String.valueOf(map.get("id"));
                    models.add(modelInfo(id, id));
                }
            }
            List<Map<String, Object>> chatModels = GeminiModelCapabilityService.chatModels(models);
            return chatModels.isEmpty() ? fallbackGeminiModels() : chatModels;
        } catch (Exception e) {
            log.warn("Failed to fetch Gemini models from API, using fallback: {}", e.getMessage());
            return fallbackGeminiModels();
        }
    }

    private List<Map<String, Object>> fallbackGeminiModels() {
        return GeminiModelCapabilityService.chatModels(List.of(
                modelInfo("claude-3-5-sonnet-20240620", "Claude 3.5 Sonnet 20240620"),
                modelInfo("claude-3-5-sonnet-20241022", "Claude 3.5 Sonnet 20241022"),
                modelInfo("claude-3-5-haiku-20241022", "Claude 3.5 Haiku 20241022"),
                modelInfo("gpt-4o", "GPT-4o"),
                modelInfo("deepseek-chat", "DeepSeek Chat"),
                modelInfo("gemini-1.5-flash", "Gemini 1.5 Flash")
        ));
    }

    private Map<String, Object> modelInfo(String id, String name) {
        Map<String, Object> model = new LinkedHashMap<>();
        model.put("id", id);
        model.put("name", name);
        return model;
    }

    private List<Map<String, Object>> fallbackModels(String provider) {
        if ("deepseek".equals(provider)) return fallbackDeepSeekModels();
        if ("openai".equals(provider)) return fallbackOpenAiModels();
        if ("gemini".equals(provider)) return fallbackGeminiModels();
        return List.of(
                modelInfo("MiniMax-M2.7", "MiniMax M2.7"),
                modelInfo("MiniMax-M2.5", "MiniMax M2.5"),
                modelInfo("MiniMax-M2.1", "MiniMax M2.1"),
                modelInfo("MiniMax-M2", "MiniMax M2")
        );
    }

    private Map<String, Object> providerView(String provider, Map<String, Object> stored) {
        Map<String, Object> settings = providerSettings(provider, stored);
        String key = apiKey(provider);
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("provider", provider);
        view.put("apiKeyConfigured", key != null && !key.isBlank());
        view.put("apiKeyMasked", mask(key));
        view.put("model", model(provider));
        view.put("models", "gemini".equals(provider) ? models(provider) : fallbackModels(provider));
        if ("deepseek".equals(provider)) view.put("baseUrl", defaultDeepSeekBaseUrl);
        if ("openai".equals(provider)) view.put("baseUrl", openAiBaseUrl());
        if ("gemini".equals(provider)) view.put("baseUrl", geminiBaseUrl());
        view.put("source", settings.containsKey("apiKey") ? "local" : "env");
        return view;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> providerSettings(String provider, Map<String, Object> stored) {
        Object value = stored.get(provider);
        if (value instanceof Map<?, ?> map) return (Map<String, Object>) map;
        return new LinkedHashMap<>();
    }



    private String mask(String key) {
        if (key == null || key.isBlank()) return "";
        if (key.length() <= 12) return "****";
        return key.substring(0, 6) + "..." + key.substring(key.length() - 4);
    }
}
