package com.weizhi.agent.service;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class MessageResolverTest {

    @Test
    void resolve_withMessagesArray_returnsNormalizedMessages() {
        Map<String, Object> body = Map.of(
            "messages", List.of(
                Map.of("role", "user", "content", "Hello"),
                Map.of("role", "assistant", "content", "Hi there")
            )
        );
        List<Map<String, String>> result = MessageResolver.resolve(body);
        assertEquals(2, result.size());
        assertEquals("user", result.get(0).get("role"));
        assertEquals("Hello", result.get(0).get("content"));
        assertEquals("assistant", result.get(1).get("role"));
    }

    @Test
    void resolve_withFallbackMessageField_returnsUserMessage() {
        Map<String, Object> body = Map.of("message", "Simple question");
        List<Map<String, String>> result = MessageResolver.resolve(body);
        assertEquals(1, result.size());
        assertEquals("user", result.get(0).get("role"));
        assertEquals("Simple question", result.get(0).get("content"));
    }

    @Test
    void resolve_unknownRoleBecomesUser() {
        Map<String, Object> body = Map.of(
            "messages", List.of(
                Map.of("role", "moderator", "content", "Some content")
            )
        );
        List<Map<String, String>> result = MessageResolver.resolve(body);
        assertEquals("user", result.get(0).get("role"));
    }

    @Test
    void resolve_emptyContentSkipped() {
        Map<String, Object> body = Map.of(
            "messages", List.of(
                Map.of("role", "user", "content", ""),
                Map.of("role", "user", "content", "Real message")
            )
        );
        List<Map<String, String>> result = MessageResolver.resolve(body);
        assertEquals(1, result.size());
        assertEquals("Real message", result.get(0).get("content"));
    }

    @Test
    void resolve_emptyBody_returnsEmptyList() {
        Map<String, Object> body = Map.of();
        List<Map<String, String>> result = MessageResolver.resolve(body);
        assertTrue(result.isEmpty());
    }

    @Test
    void resolve_systemRolePreserved() {
        Map<String, Object> body = Map.of(
            "messages", List.of(
                Map.of("role", "system", "content", "System prompt")
            )
        );
        List<Map<String, String>> result = MessageResolver.resolve(body);
        assertEquals("system", result.get(0).get("role"));
    }

    @Test
    void resolve_messageFieldIsAppendedAfterHistory() {
        Map<String, Object> body = Map.of(
            "message", "生成一张小狗的照片",
            "messages", List.of(
                Map.of("role", "assistant", "content", "图片已生成: /api/images/files/old.jpg")
            )
        );

        List<Map<String, String>> result = MessageResolver.resolve(body);

        assertEquals(2, result.size());
        assertEquals("assistant", result.get(0).get("role"));
        assertEquals("图片已生成: /api/images/files/old.jpg", result.get(0).get("content"));
        assertEquals("user", result.get(1).get("role"));
        assertEquals("生成一张小狗的照片", result.get(1).get("content"));
    }

    @Test
    void resolve_messageFieldDoesNotDuplicateSameLastUserMessage() {
        Map<String, Object> body = Map.of(
            "message", "生成一张小狗的照片",
            "messages", List.of(
                Map.of("role", "user", "content", "生成一张小狗的照片")
            )
        );

        List<Map<String, String>> result = MessageResolver.resolve(body);

        assertEquals(1, result.size());
        assertEquals("user", result.get(0).get("role"));
        assertEquals("生成一张小狗的照片", result.get(0).get("content"));
    }
}
