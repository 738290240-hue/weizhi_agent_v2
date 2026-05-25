package com.weizhi.agent.model;

import lombok.Data;

@Data
public class ImageGenerationRequest {
    private String prompt;
    private String aspectRatio;
    private Integer count;
    private String stylePreset;
    private String negativePrompt;
    private String model;
}
