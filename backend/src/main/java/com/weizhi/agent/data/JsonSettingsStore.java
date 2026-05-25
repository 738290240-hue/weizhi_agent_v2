package com.weizhi.agent.data;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class JsonSettingsStore implements SettingsStore {
    private static final Logger log = LoggerFactory.getLogger(JsonSettingsStore.class);

    private final ObjectMapper objectMapper;

    @Value("${settings.file:data/ai-settings.json}")
    private String settingsFile;

    public JsonSettingsStore(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void setSettingsFile(String settingsFile) {
        this.settingsFile = settingsFile;
    }

    public String getSettingsFile() {
        return settingsFile;
    }

    @Override
    public Map<String, Object> readStored() {
        try {
            Path path = Paths.get(settingsFile).toAbsolutePath().normalize();
            if (!Files.exists(path)) return new LinkedHashMap<>();
            return objectMapper.readValue(path.toFile(), new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.warn("Failed to read settings file {}: {}", settingsFile, e.getMessage());
            return new LinkedHashMap<>();
        }
    }

    @Override
    public void writeStored(Map<String, Object> settings) {
        try {
            Path path = Paths.get(settingsFile).toAbsolutePath().normalize();
            if (path.getParent() != null) Files.createDirectories(path.getParent());
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(path.toFile(), settings);
        } catch (Exception e) {
            log.error("Failed to write settings file {}: {}", settingsFile, e.getMessage(), e);
        }
    }
}
