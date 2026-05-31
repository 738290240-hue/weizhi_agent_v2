package com.weizhi.agent.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "storage")
public class StorageProperties {
    private String audioDir = "generated_audio";
    private String imageDir = "generated_images";
    private String imageHistoryFile = "data/image-history.json";
    private String ttsHistoryFile = "data/tts-history.json";
    private String documentDir = "generated_documents";
    private String documentIndexFile = "data/document-index.json";
}
