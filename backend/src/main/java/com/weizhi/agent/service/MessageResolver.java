package com.weizhi.agent.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Utility class for resolving chat messages from a request body.
 * Extracted to eliminate duplicated resolveMessages() in ChatController and DeepSeekChatController.
 */
public final class MessageResolver {

    private MessageResolver() {}

    /**
     * Extracts and normalizes a list of {role, content} messages from the request body.
     * First looks for a "messages" array; falls back to a single "message" string field.
     *
     * @param requestBody the raw request body map
     * @return list of normalized message maps with "role" and "content" keys
     */
    public static List<Map<String, String>> resolve(Map<String, Object> requestBody) {
        List<Map<String, String>> messages = new ArrayList<>();

        Object rawMessages = requestBody.get("messages");
        if (rawMessages instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    Object rawRole = map.get("role");
                    Object rawContent = map.get("content");
                    String role = rawRole == null ? "user" : String.valueOf(rawRole);
                    String content = rawContent == null ? "" : String.valueOf(rawContent).trim();
                    if (content.isEmpty()) continue;
                    if (!"assistant".equals(role) && !"system".equals(role)) role = "user";
                    messages.add(Map.of("role", role, "content", content));
                }
            }
        }

        if (!messages.isEmpty()) return messages;

        // Fallback: single "message" field
        Object message = requestBody.get("message");
        String content = message == null ? "" : String.valueOf(message).trim();
        if (!content.isEmpty()) messages.add(Map.of("role", "user", "content", content));

        return messages;
    }
}
