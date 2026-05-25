package com.weizhi.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;

public class TestConvertValue {
    public static void main(String[] args) throws Exception {
        String raw = "{\"id\":\"resp_123\",\"object\":\"chat.completion\"}";
        ObjectMapper objectMapper = new ObjectMapper();
        JsonNode root = objectMapper.readTree(raw);
        System.out.println("Root: " + root);
        try {
            System.out.println("Path usage: " + root.path("usage"));
            Map<String, Object> usage = objectMapper.convertValue(root.path("usage"), Map.class);
            System.out.println("Usage: " + usage);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
