package com.weizhi.agent.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public final class GeminiModelCapabilityService {
    public static final String DEFAULT_CHAT_MODEL = "claude-3-5-sonnet-20240620";
    public static final String DEFAULT_IMAGE_MODEL = "gemini-3-pro-image";

    public enum GeminiTaskMode {
        TEXT,
        IMAGE
    }

    private GeminiModelCapabilityService() {}

    public static GeminiTaskMode resolveTaskMode(String requestedMode, String latestUserMessage) {
        String mode = requestedMode == null ? "auto" : requestedMode.trim().toLowerCase(Locale.ROOT);
        if ("image".equals(mode)) return GeminiTaskMode.IMAGE;
        if ("text".equals(mode)) return GeminiTaskMode.TEXT;
        return ImageRequestDetector.looksLikeImageRequest(latestUserMessage) ? GeminiTaskMode.IMAGE : GeminiTaskMode.TEXT;
    }

    public static List<Map<String, Object>> chatModels(List<Map<String, Object>> models) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> model : models) {
            String id = String.valueOf(model.getOrDefault("id", ""));
            if (isChatModel(id)) {
                result.add(model);
            }
        }
        result.sort(Comparator.comparingInt(model ->
                DEFAULT_CHAT_MODEL.equals(String.valueOf(model.get("id"))) ? 0 : 1));
        return result;
    }

    public static List<Map<String, Object>> imageModels(List<Map<String, Object>> models) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> model : models) {
            String id = String.valueOf(model.getOrDefault("id", ""));
            if (isImageModel(id)) {
                result.add(model);
            }
        }
        result.sort(Comparator.comparingInt(model ->
                DEFAULT_IMAGE_MODEL.equals(String.valueOf(model.get("id"))) ? 0 : 1));
        return result;
    }

    public static boolean isChatModel(String id) {
        String normalized = id == null ? "" : id.toLowerCase(Locale.ROOT);
        if (normalized.contains("image")
                || normalized.contains("embedding")
                || normalized.contains("audio")
                || normalized.contains("video")
                || normalized.contains("tts")
                || normalized.contains("whisper")
                || normalized.contains("realtime")
                || normalized.contains("moderation")
                || normalized.contains("rerank")
                || normalized.contains("internal")
                || normalized.contains("thinking")) {
            return false;
        }
        return normalized.contains("claude")
                || normalized.contains("gemini")
                || normalized.contains("gpt")
                || normalized.contains("deepseek");
    }

    public static boolean isImageModel(String id) {
        String normalized = id == null ? "" : id.toLowerCase(Locale.ROOT);
        return normalized.contains("image")
                && !normalized.contains("internal")
                && !normalized.contains("embedding")
                && !normalized.contains("audio")
                && !normalized.contains("video");
    }
}
