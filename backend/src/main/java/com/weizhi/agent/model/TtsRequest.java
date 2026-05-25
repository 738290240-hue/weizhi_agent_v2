package com.weizhi.agent.model;

import lombok.Data;

@Data
public class TtsRequest {
    private String text;
    private String voiceId;
    private String model;
    private String format;
    private Double speed;
    private Double vol;
    private Integer pitch;
    private Integer sampleRate;
    private Integer bitrate;
    private String languageBoost;
    private String source;
}

