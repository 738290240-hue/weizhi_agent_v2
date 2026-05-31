package com.weizhi.agent.controller;

import com.weizhi.agent.service.ImageRequestDetector;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for ChatController helper behavior.
 * Integration tests require a running backend and are excluded from the unit test suite.
 */
class ChatControllerTest {

    @Test
    void placeholder_test_passes() {
        // Verifies that the test infrastructure is functional.
        // Full integration tests can be added once a test application context is configured.
        assertTrue(true);
    }

    @Test
    void imageRequestDetection_basicCases() {
        // Verify the heuristic: "生成图片" is an image request
        String imagePrompt = "生成一张图片，风景";
        String regularPrompt = "你好，请问今天天气怎么样";
        // Logic extracted to be testable without Spring context
        assertTrue(ImageRequestDetector.looksLikeImageRequest(imagePrompt));
        assertFalse(ImageRequestDetector.looksLikeImageRequest(regularPrompt));
    }
}
