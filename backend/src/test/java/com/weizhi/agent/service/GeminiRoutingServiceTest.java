package com.weizhi.agent.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GeminiRoutingServiceTest {

    @Test
    void routesToStableDefaultModelWhenNoCapabilitiesAreGiven() {
        GeminiRoutingService routingService = new GeminiRoutingService();
        GeminiRouteDecision decision = routingService.route(
                "hello",
                "auto",
                List.of()
        );

        assertNotNull(decision);
        assertEquals("claude-3-5-sonnet-20240620", decision.getModel());
        assertTrue(decision.getReason().contains("回退"));
    }

    @Test
    void routesCodeToAdvancedClaudeWhenAvailable() {
        GeminiRoutingService routingService = new GeminiRoutingService();
        GeminiRouteDecision decision = routingService.route(
                "帮我用 Java 代码写一个快速排序算法",
                "auto",
                List.of(
                        new GeminiModelCapability("claude-3-5-sonnet-20240620", "stable", true, 200, "ok", "", "", 10, ""),
                        new GeminiModelCapability("claude-3-5-opus-20240620", "advancedClaude", true, 200, "ok", "", "", 10, "")
                )
        );

        assertNotNull(decision);
        assertEquals("claude-3-5-opus-20240620", decision.getModel());
        assertEquals("code", decision.getMode());
    }

    @Test
    void routesImageToFallbackWhenNoImageModelIsAvailable() {
        GeminiRoutingService routingService = new GeminiRoutingService();
        GeminiRouteDecision decision = routingService.route(
                "画一张可爱的橘猫图片",
                "auto",
                List.of(
                        new GeminiModelCapability("claude-3-5-sonnet-20240620", "stable", true, 200, "ok", "", "", 10, "")
                )
        );

        assertNotNull(decision);
        assertEquals("image", decision.getMode());
        assertNotNull(decision.getFallbackMessage());
        assertTrue(decision.getFallbackMessage().contains("提示词"));
    }
}
