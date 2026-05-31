package com.weizhi.agent.service;

import java.util.List;

public final class ImageRequestDetector {
    private static final List<String> QUESTION_MARKERS = List.of(
            "为什么", "怎么", "如何", "啥", "什么", "吗", "?", "？", "why", "how", "what"
    );

    private ImageRequestDetector() {}

    public static boolean looksLikeImageRequest(String input) {
        if (input == null || input.isBlank()) return false;
        String s = input.toLowerCase();
        if (s.contains("/api/images/files/") || s.contains("图片已生成")) return false;
        if (QUESTION_MARKERS.stream().anyMatch(s::contains)) return false;
        return (s.contains("生成") || s.contains("画") || s.contains("创建") || s.contains("draw") || s.contains("create"))
                && (s.contains("图片") || s.contains("图像") || s.contains("照片") || s.contains("image") || s.contains("picture"));
    }
}
