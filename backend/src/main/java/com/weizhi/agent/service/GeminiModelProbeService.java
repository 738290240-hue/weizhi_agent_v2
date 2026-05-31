package com.weizhi.agent.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class GeminiModelProbeService {
    private static final Logger log = LoggerFactory.getLogger(GeminiModelProbeService.class);

    private final AiSettingsService settingsService;
    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final ExecutorService executor = Executors.newFixedThreadPool(15);

    private volatile GeminiCapabilitiesResult lastResult = null;
    private volatile Instant lastProbeTime = null;
    private static final Duration CACHE_TTL = Duration.ofMinutes(30);

    public GeminiModelProbeService(AiSettingsService settingsService, OkHttpClient okHttpClient, ObjectMapper objectMapper) {
        this.settingsService = settingsService;
        this.httpClient = okHttpClient;
        this.objectMapper = objectMapper;
    }

    public synchronized GeminiCapabilitiesResult getCapabilities() {
        if (lastResult == null || 
            lastProbeTime == null || 
            Duration.between(lastProbeTime, Instant.now()).compareTo(CACHE_TTL) > 0) {
            int timeoutSeconds = (lastResult == null) ? 8 : 3;
            probe(timeoutSeconds);
        }
        return lastResult;
    }

    public synchronized GeminiCapabilitiesResult probe() {
        return probe(8);
    }

    public synchronized GeminiCapabilitiesResult probe(int timeoutSeconds) {
        String apiKey = settingsService.apiKey("gemini");
        String baseUrl = settingsService.geminiBaseUrl();

        List<String> modelIds = new ArrayList<>();
        // Fetch from models API
        Request.Builder requestBuilder = new Request.Builder()
                .url(baseUrl + "/models")
                .get();
        if (apiKey != null && !apiKey.isBlank()) {
            requestBuilder.addHeader("Authorization", "Bearer " + apiKey);
        }

        OkHttpClient modelsClient = httpClient.newBuilder()
                .connectTimeout(timeoutSeconds, java.util.concurrent.TimeUnit.SECONDS)
                .readTimeout(timeoutSeconds, java.util.concurrent.TimeUnit.SECONDS)
                .build();

        try (Response response = modelsClient.newCall(requestBuilder.build()).execute()) {
            if (response.isSuccessful() && response.body() != null) {
                Map<String, Object> root = objectMapper.readValue(response.body().string(), new TypeReference<Map<String, Object>>() {});
                Object data = root.get("data");
                if (data instanceof List<?> list) {
                    for (Object item : list) {
                        if (item instanceof Map<?, ?> map && map.get("id") != null) {
                            modelIds.add(String.valueOf(map.get("id")));
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to fetch models for probing: {}", e.getMessage());
        }

        // If empty, use fallback models
        if (modelIds.isEmpty()) {
            modelIds = List.of(
                    "claude-3-5-sonnet-20240620",
                    "claude-3-5-sonnet-20241022",
                    "claude-3-5-haiku-20241022",
                    "gemini-1.5-flash",
                    "gpt-4o",
                    "gemini-3-pro-image"
            );
        }

        // Run probes in parallel using CompletableFuture
        List<CompletableFuture<GeminiModelCapability>> futures = new ArrayList<>();
        for (String id : modelIds) {
            String group = determineGroup(id);
            futures.add(CompletableFuture.supplyAsync(() -> probeModel(id, group, apiKey, baseUrl, timeoutSeconds), executor));
        }

        List<GeminiModelCapability> probedList = futures.stream()
                .map(CompletableFuture::join)
                .sorted((a, b) -> {
                    int o1 = groupOrder(a.getGroup());
                    int o2 = groupOrder(b.getGroup());
                    if (o1 != o2) return Integer.compare(o1, o2);
                    return a.getId().compareTo(b.getId());
                })
                .toList();

        // Detect account email from any available capability
        String detectedEmail = "";
        for (GeminiModelCapability cap : probedList) {
            if (cap.isAvailable() && cap.getAccountEmail() != null && !cap.getAccountEmail().isBlank()) {
                detectedEmail = cap.getAccountEmail();
                break;
            }
        }

        GeminiCapabilitiesResult result = new GeminiCapabilitiesResult(
                baseUrl,
                java.time.LocalDateTime.now().toString(),
                detectedEmail,
                probedList
        );

        this.lastProbeTime = Instant.now();
        this.lastResult = result;
        return result;
    }

    private GeminiModelCapability probeModel(String id, String group, String apiKey, String baseUrl, int timeoutSeconds) {
        long start = System.currentTimeMillis();
        GeminiModelCapability cap = new GeminiModelCapability();
        cap.setId(id);
        cap.setGroup(group);
        cap.setRecommendedUse(recommendedUse(id, group));

        if ("disabled".equals(group)) {
            cap.setAvailable(false);
            cap.setStatusCode(0);
            cap.setErrorType("disabled");
            cap.setRecommendedUse("已禁用或非文本对话模型");
            return cap;
        }

        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("model", id);
            payload.put("messages", List.of(Map.of("role", "user", "content", "只回答两个字：可用")));
            payload.put("max_tokens", 10);

            RequestBody body = RequestBody.create(
                    objectMapper.writeValueAsString(payload),
                    MediaType.parse("application/json")
            );

            Request.Builder requestBuilder = new Request.Builder()
                    .url(baseUrl + "/chat/completions")
                    .post(body);

            if (apiKey != null && !apiKey.isBlank()) {
                requestBuilder.addHeader("Authorization", "Bearer " + apiKey);
            }

            OkHttpClient probeClient = httpClient.newBuilder()
                    .connectTimeout(timeoutSeconds, java.util.concurrent.TimeUnit.SECONDS)
                    .readTimeout(timeoutSeconds, java.util.concurrent.TimeUnit.SECONDS)
                    .writeTimeout(timeoutSeconds, java.util.concurrent.TimeUnit.SECONDS)
                    .build();

            try (Response response = probeClient.newCall(requestBuilder.build()).execute()) {
                long latency = System.currentTimeMillis() - start;
                cap.setLatencyMs(latency);
                cap.setStatusCode(response.code());

                String mappedModel = response.header("x-mapped-model");
                String accountEmail = response.header("x-account-email");
                cap.setMappedModel(mappedModel != null ? mappedModel : "");
                cap.setAccountEmail(accountEmail != null ? accountEmail : "");

                if (response.isSuccessful()) {
                    cap.setAvailable(true);
                    cap.setErrorType("ok");
                } else {
                    cap.setAvailable(false);
                    String rawBody = response.body() == null ? "" : response.body().string().toLowerCase(Locale.ROOT);
                    if (response.code() == 404) {
                        cap.setErrorType("not_found");
                    } else if (response.code() == 429 || rawBody.contains("quota") || rawBody.contains("exhausted") || rawBody.contains("balance")) {
                        cap.setErrorType("quota_exhausted");
                    } else if (response.code() == 400 || response.code() == 422) {
                        cap.setErrorType("invalid_argument");
                    } else {
                        cap.setErrorType("unknown");
                    }
                }
            }
        } catch (java.net.SocketTimeoutException e) {
            cap.setAvailable(false);
            cap.setStatusCode(0);
            cap.setErrorType("timeout");
            cap.setLatencyMs(System.currentTimeMillis() - start);
        } catch (Exception e) {
            cap.setAvailable(false);
            cap.setStatusCode(0);
            cap.setErrorType("unknown");
            cap.setLatencyMs(System.currentTimeMillis() - start);
        }
        return cap;
    }

    private String determineGroup(String id) {
        if (id == null) return "disabled";
        String lower = id.toLowerCase(Locale.ROOT);

        // Filter out non-text-chat model types (image/audio/video/tts/embedding etc.)
        // Note: do NOT filter "thinking" — Claude models with thinking capability are still valid chat models
        if (lower.contains("image")
                || "internal-background-task".equals(lower)
                || lower.contains("embedding")
                || lower.contains("audio")
                || lower.contains("video")
                || lower.contains("tts")
                || lower.contains("realtime")
                || lower.contains("moderation")
                || lower.contains("rerank")
                || lower.contains("whisper")
                || lower.contains("dall-e")
                || lower.contains("stable-diffusion")) {
            return "disabled";
        }

        // Stable baseline model
        if ("claude-3-5-sonnet-20240620".equals(lower)) {
            return "stable";
        }

        // Claude family — all versions including claude-opus-4, claude-sonnet-4, claude-haiku-4, claude-3-7, claude-4, etc.
        if (lower.startsWith("claude-sonnet-") || lower.startsWith("claude-opus-") || lower.startsWith("claude-haiku-")
                || lower.startsWith("claude-3-") || lower.startsWith("claude-4-") || lower.startsWith("claude-4.")
                || lower.contains("claude-3-5-sonnet") || lower.contains("claude-3-5-haiku") || lower.contains("claude-3-opus")
                || lower.contains("claude-3-7") || lower.contains("claude-4")) {
            return "advancedClaude";
        }

        if (lower.startsWith("gemini-3-pro") || lower.startsWith("gemini-3.1-pro")
                || lower.startsWith("gemini-2.5-flash") || lower.startsWith("gemini-3-flash")
                || lower.contains("gemini-1.5-pro") || lower.contains("gemini-1.5-flash")
                || lower.contains("gemini-2.5") || lower.contains("gemini-3")
                || lower.contains("gemini-2.0") || lower.contains("gemini-2.")) {
            return "geminiText";
        }

        // OpenAI / GPT family — includes gpt-4o, gpt-4, gpt-4.1, o1, o3, o4-mini etc.
        if (lower.startsWith("gpt-4o") || lower.startsWith("gpt-4-turbo") || lower.startsWith("gpt-4")
                || lower.startsWith("gpt-4.") || lower.startsWith("o1") || lower.startsWith("o3")
                || lower.startsWith("o4") || lower.contains("gpt-4") || lower.startsWith("gpt-3.5")) {
            return "gptText";
        }

        if (lower.contains("claude")) return "advancedClaude";
        if (lower.contains("gemini")) return "geminiText";
        if (lower.contains("gpt") || lower.startsWith("o1") || lower.startsWith("o3") || lower.startsWith("o4")) return "gptText";

        return "disabled";
    }

    private String recommendedUse(String id, String group) {
        if ("stable".equals(group)) {
            return "默认主力模型：普通问答、代码、方案、长文分析";
        }
        if ("advancedClaude".equals(group)) {
            return "高级推理与分析模型：深度代码审查、复杂系统设计";
        }
        if ("geminiText".equals(group)) {
            return "高性价比多模态模型：快速问答、创意写作、日常咨询";
        }
        if ("gptText".equals(group)) {
            return "通用强力模型：逻辑推理、结构化数据处理";
        }
        return "当前账户不可用或非文本对话模型";
    }

    private int groupOrder(String group) {
        return switch (group) {
            case "stable" -> 0;
            case "advancedClaude" -> 1;
            case "geminiText" -> 2;
            case "gptText" -> 3;
            default -> 4;
        };
    }
}
