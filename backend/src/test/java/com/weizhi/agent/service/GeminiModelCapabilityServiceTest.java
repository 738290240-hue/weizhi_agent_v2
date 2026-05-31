package com.weizhi.agent.service;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class GeminiModelCapabilityServiceTest {

    @Test
    void filtersChatModelsAwayFromImageAndThinkingModels() {
        List<Map<String, Object>> models = GeminiModelCapabilityService.chatModels(List.of(
                Map.of("id", "gemini-3-pro-image-1x1"),
                Map.of("id", "claude-3-5-sonnet-20240620"),
                Map.of("id", "gemini-2.5-flash-thinking"),
                Map.of("id", "internal-background-task"),
                Map.of("id", "gemini-3-pro")
        ));

        assertEquals(List.of("claude-3-5-sonnet-20240620", "gemini-3-pro"),
                models.stream().map(item -> String.valueOf(item.get("id"))).toList());
    }

    @Test
    void filtersImageModelsAndPrioritizesStableSquareModel() {
        List<Map<String, Object>> models = GeminiModelCapabilityService.imageModels(List.of(
                Map.of("id", "claude-3-5-sonnet-20240620"),
                Map.of("id", "gemini-3-pro-image-16x9"),
                Map.of("id", "gemini-3-pro-image"),
                Map.of("id", "gemini-3-pro-image-1x1"),
                Map.of("id", "gemini-3-pro")
        ));

        assertEquals(List.of("gemini-3-pro-image", "gemini-3-pro-image-16x9", "gemini-3-pro-image-1x1"),
                models.stream().map(item -> String.valueOf(item.get("id"))).toList());
    }

    @Test
    void routesAutoModeImagePromptToImageGeneration() {
        assertEquals(GeminiModelCapabilityService.GeminiTaskMode.IMAGE,
                GeminiModelCapabilityService.resolveTaskMode("auto", "生成一张小狗照片"));
        assertEquals(GeminiModelCapabilityService.GeminiTaskMode.TEXT,
                GeminiModelCapabilityService.resolveTaskMode("auto", "为什么生成图片总是出问题"));
        assertEquals(GeminiModelCapabilityService.GeminiTaskMode.IMAGE,
                GeminiModelCapabilityService.resolveTaskMode("image", "帮我设计海报"));
    }
}
