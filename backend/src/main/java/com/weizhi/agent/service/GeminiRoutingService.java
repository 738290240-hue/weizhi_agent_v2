package com.weizhi.agent.service;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;

@Service
public class GeminiRoutingService {

    public GeminiRouteDecision route(String userMessage, String requestedMode, List<GeminiModelCapability> capabilities) {
        String mode = requestedMode == null ? "auto" : requestedMode.trim().toLowerCase(Locale.ROOT);
        String cleanMsg = userMessage == null ? "" : userMessage.trim();

        // 1. Resolve to task mode (TEXT or IMAGE)
        boolean isImageRequest = "image".equals(mode) || ("auto".equals(mode) && looksLikeImageRequest(cleanMsg));

        if (isImageRequest) {
            // Check if any image model is available
            GeminiModelCapability availableImageModel = capabilities.stream()
                    .filter(c -> c.isAvailable() && (c.getId().contains("image") || "gemini-3-pro-image".equals(c.getId())))
                    .findFirst()
                    .orElse(null);

            if (availableImageModel != null) {
                return new GeminiRouteDecision(
                        "image",
                        availableImageModel.getId(),
                        "openai",
                        "探测到可用的图片生成模型：" + availableImageModel.getId(),
                        null
                );
            } else {
                return new GeminiRouteDecision(
                        "image",
                        GeminiModelCapabilityService.DEFAULT_IMAGE_MODEL,
                        "openai",
                        "图片生成模型不可用，触发提示词降级方案",
                        generateFallbackPrompt(cleanMsg)
                );
            }
        }

        // 2. Select candidates by group
        List<GeminiModelCapability> stableList = capabilities.stream().filter(c -> c.isAvailable() && "stable".equals(c.getGroup())).toList();
        List<GeminiModelCapability> advancedList = capabilities.stream().filter(c -> c.isAvailable() && "advancedClaude".equals(c.getGroup())).toList();
        List<GeminiModelCapability> geminiList = capabilities.stream().filter(c -> c.isAvailable() && "geminiText".equals(c.getGroup())).toList();
        List<GeminiModelCapability> gptList = capabilities.stream().filter(c -> c.isAvailable() && "gptText".equals(c.getGroup())).toList();

        // 3. Determine inner mode (text, code, review) if requestedMode is auto
        String resolvedMode = mode;
        if ("auto".equals(mode)) {
            if (isCodeOrReviewRequest(cleanMsg)) {
                resolvedMode = "code";
            } else if (isQuickQaRequest(cleanMsg)) {
                resolvedMode = "quick";
            } else {
                resolvedMode = "text";
            }
        }

        // 4. Perform routing based on resolvedMode
        String routedModel;
        String reason;

        if ("code".equals(resolvedMode) || "review".equals(resolvedMode)) {
            if (!advancedList.isEmpty()) {
                routedModel = advancedList.get(0).getId();
                reason = "代码或系统设计请求，路由至高级 Claude 推理模型：" + routedModel;
            } else if (!stableList.isEmpty()) {
                routedModel = stableList.get(0).getId();
                reason = "代码请求，但未发现高级 Claude，路由至默认主力 Claude 模型：" + routedModel;
            } else if (!gptList.isEmpty()) {
                routedModel = gptList.get(0).getId();
                reason = "代码请求，路由至可用强力 GPT 模型：" + routedModel;
            } else if (!geminiList.isEmpty()) {
                routedModel = geminiList.get(0).getId();
                reason = "代码请求，路由至可用 Gemini 文本模型：" + routedModel;
            } else {
                routedModel = GeminiModelCapabilityService.DEFAULT_CHAT_MODEL;
                reason = "代码请求，未检测到可用模型，回退至系统默认 Claude 3.5 Sonnet";
            }
        } else if ("quick".equals(resolvedMode)) {
            if (!geminiList.isEmpty()) {
                routedModel = geminiList.get(0).getId();
                reason = "快速日常问答，路由至高性价比轻量 Gemini 模型：" + routedModel;
            } else if (!stableList.isEmpty()) {
                routedModel = stableList.get(0).getId();
                reason = "快速日常问答，路由至主力 Claude 模型：" + routedModel;
            } else if (!advancedList.isEmpty()) {
                routedModel = advancedList.get(0).getId();
                reason = "快速问答，但只有高级 Claude 可用，路由至：" + routedModel;
            } else if (!gptList.isEmpty()) {
                routedModel = gptList.get(0).getId();
                reason = "快速问答，路由至可用 GPT 模型：" + routedModel;
            } else {
                routedModel = GeminiModelCapabilityService.DEFAULT_CHAT_MODEL;
                reason = "快速问答，未检测到可用模型，回退至默认 Claude 3.5 Sonnet";
            }
        } else { // text mode
            if (!stableList.isEmpty()) {
                routedModel = stableList.get(0).getId();
                reason = "常规聊天与综合分析，路由至默认主力 Claude 模型：" + routedModel;
            } else if (!advancedList.isEmpty()) {
                routedModel = advancedList.get(0).getId();
                reason = "常规聊天，路由至高级 Claude 模型：" + routedModel;
            } else if (!geminiList.isEmpty()) {
                routedModel = geminiList.get(0).getId();
                reason = "常规聊天，路由至可用 Gemini 文本模型：" + routedModel;
            } else if (!gptList.isEmpty()) {
                routedModel = gptList.get(0).getId();
                reason = "常规聊天，路由至可用 GPT 文本模型：" + routedModel;
            } else {
                routedModel = GeminiModelCapabilityService.DEFAULT_CHAT_MODEL;
                reason = "常规聊天，未检测到可用模型，回退至默认 Claude 3.5 Sonnet";
            }
        }

        return new GeminiRouteDecision(
                resolvedMode,
                routedModel,
                "openai",
                reason,
                null
        );
    }

    private boolean looksLikeImageRequest(String input) {
        if (input == null || input.isBlank()) return false;
        String s = input.toLowerCase(Locale.ROOT);
        if (s.contains("/api/images/files/") || s.contains("图片已生成")) return false;
        
        List<String> questionMarkers = List.of("为什么", "怎么", "如何", "啥", "什么", "吗", "?", "？", "why", "how", "what");
        if (questionMarkers.stream().anyMatch(s::contains)) return false;

        return (s.contains("生成") || s.contains("画") || s.contains("创建") || s.contains("draw") || s.contains("create") || s.contains("设计"))
                && (s.contains("图片") || s.contains("图像") || s.contains("照片") || s.contains("image") || s.contains("picture") || s.contains("海报") || s.contains("壁纸"));
    }

    private boolean isCodeOrReviewRequest(String s) {
        if (s == null || s.isBlank()) return false;
        String lower = s.toLowerCase(Locale.ROOT);
        if (lower.length() > 800) return true;

        List<String> codeKeywords = List.of(
                "代码", "架构", "审查", "审阅", "设计", "重构", "优化", "单元测试", "并发",
                "code", "architecture", "review", "refactor", "bug", "error", "compile", "编译",
                "class", "function", "method", "java", "python", "javascript", "spring", "vue", "react"
        );
        return codeKeywords.stream().anyMatch(lower::contains);
    }

    private boolean isQuickQaRequest(String s) {
        if (s == null || s.isBlank()) return true;
        String lower = s.toLowerCase(Locale.ROOT);
        if (lower.length() < 100) return true;

        List<String> quickKeywords = List.of("你好", "hello", "hi", "who are you", "你是谁", "什么", "怎么", "why", "how", "what");
        return quickKeywords.stream().anyMatch(lower::contains);
    }

    private String generateFallbackPrompt(String userMessage) {
        String cleanMsg = userMessage == null ? "" : userMessage.trim();
        String coreTopic = cleanMsg.replaceAll("(?i)^(生成一张|画一张|画个|生成一个|创建一个|设计一个|生成|画|创建|design|create|draw|generate|a|an|pic of|picture of|image of|photo of|paint)", "")
                .replaceAll("(?i)(的图片|的图像|的画|的照片|图片|图像|照片|image|picture|photo|illustration)$", "")
                .trim();
        if (coreTopic.isEmpty()) {
            coreTopic = "精美插画";
        }

        String zhPrompt;
        String enPrompt;

        if (coreTopic.contains("古寺") || coreTopic.contains("庙") || coreTopic.contains("temple")) {
            zhPrompt = "一座唐朝风格的古寺庙，飞檐斗拱，青石台阶，清晨薄雾，远山背景，电影级光影，写实风格，高细节。";
            enPrompt = "A Tang dynasty ancient temple with sweeping eaves and dougong brackets, stone steps, morning mist, distant mountains, cinematic lighting, photorealistic, highly detailed.";
        } else if (coreTopic.contains("猫") || coreTopic.contains("狗") || coreTopic.contains("宠物") || coreTopic.contains("cat") || coreTopic.contains("dog")) {
            zhPrompt = "一只可爱的" + coreTopic + "，特写镜头，柔和温暖的室内光线，毛发细节清晰可见，高分辨率，写实摄影风格，温馨氛围。";
            enPrompt = "A cute " + coreTopic + ", close-up shot, soft and warm indoor lighting, detailed fur texture clearly visible, high resolution, realistic photography style, cozy atmosphere.";
        } else if (coreTopic.contains("风景") || coreTopic.contains("山") || coreTopic.contains("海") || coreTopic.contains("landscape") || coreTopic.contains("mountain") || coreTopic.contains("sea")) {
            zhPrompt = "壮丽的" + coreTopic + "风景，日落时分的黄金光辉，波光粼粼的水面或连绵起伏的山峦，极简构图，超广角镜头，大师级画质。";
            enPrompt = "A magnificent landscape of " + coreTopic + " under the golden glow of sunset, shimmering water or rolling mountains, minimalist composition, ultra-wide-angle lens, masterfully detailed.";
        } else {
            zhPrompt = "一张关于“" + coreTopic + "”的高精细插画，现代数字艺术风格，丰富和谐的色彩搭配，极具故事感的构图，电影级体积光，完美细节。";
            enPrompt = "A highly detailed digital illustration of '" + coreTopic + "', modern digital art style, rich and harmonious color palette, storytelling composition, cinematic volumetric lighting, perfect details.";
        }

        return "当前 Gemini 图片生成不可用：中转站可以列出 gemini-3-pro-image，但上游返回 Google 404 NOT_FOUND，通常是账号未开通 Imagen 3 或地区/结算限制。\n\n" +
                "我已先为你整理好可用于生图模型的提示词：\n\n" +
                "**中文：**\n" + zhPrompt + "\n\n" +
                "**English：**\n" + enPrompt;
    }
}
