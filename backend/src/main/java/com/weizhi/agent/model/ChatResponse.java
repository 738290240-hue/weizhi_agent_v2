package com.weizhi.agent.model;

import lombok.Data;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Data
public class ChatResponse {
    private String text;
    private List<ChatMedia> media = new ArrayList<>();
    private Map<String, Object> metadata = new LinkedHashMap<>();
}
