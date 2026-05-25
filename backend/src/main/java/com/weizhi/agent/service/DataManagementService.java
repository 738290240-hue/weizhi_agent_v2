package com.weizhi.agent.service;

import com.weizhi.agent.config.StorageProperties;
import com.weizhi.agent.data.DataSourceMode;
import com.weizhi.agent.data.JsonSettingsStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class DataManagementService {
    private final JsonSettingsStore jsonSettingsStore;
    private final StorageProperties storageProperties;
    private DataSourceMode mode;

    public DataManagementService(
            JsonSettingsStore jsonSettingsStore,
            StorageProperties storageProperties,
            @Value("${data-management.mode:json}") String configuredMode
    ) {
        this.jsonSettingsStore = jsonSettingsStore;
        this.storageProperties = storageProperties;
        this.mode = DataSourceMode.from(configuredMode);
        if (this.mode == DataSourceMode.POSTGRESQL) {
            this.mode = DataSourceMode.JSON;
        }
    }

    public synchronized Map<String, Object> status() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("mode", mode.value());
        result.put("ready", true);
        result.put("json", jsonStatus());
        result.put("postgresql", postgresqlStatus());
        return result;
    }

    public synchronized Map<String, Object> switchMode(String requestedMode) {
        DataSourceMode requested = DataSourceMode.from(requestedMode);
        Map<String, Object> result = new LinkedHashMap<>();
        if (requested == DataSourceMode.POSTGRESQL) {
            mode = DataSourceMode.JSON;
            result.put("success", false);
            result.put("mode", mode.value());
            result.put("message", "PostgreSQL mode is visible but not ready in this phase.");
            result.put("status", status());
            return result;
        }
        mode = DataSourceMode.JSON;
        result.put("success", true);
        result.put("mode", mode.value());
        result.put("message", "JSON file mode is active.");
        result.put("status", status());
        return result;
    }

    public synchronized Map<String, Object> testConnection(String requestedMode) {
        DataSourceMode requested = DataSourceMode.from(requestedMode);
        if (requested == DataSourceMode.POSTGRESQL) {
            return Map.of(
                    "success", false,
                    "mode", "postgresql",
                    "message", "PostgreSQL connection testing will be available after the database store is implemented."
            );
        }
        return Map.of(
                "success", true,
                "mode", "json",
                "message", "JSON files are available.",
                "json", jsonStatus()
        );
    }

    private Map<String, Object> jsonStatus() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("settings", fileInfo(jsonSettingsStore.getSettingsFile(), "object"));
        status.put("imageHistory", fileInfo(storageProperties.getImageHistoryFile(), "array"));
        status.put("ttsHistory", fileInfo(storageProperties.getTtsHistoryFile(), "array"));
        return status;
    }

    private Map<String, Object> postgresqlStatus() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("configured", false);
        status.put("available", false);
        status.put("ready", false);
        status.put("message", "PostgreSQL store is planned for the next phase.");
        return status;
    }

    private Map<String, Object> fileInfo(String filePath, String shape) {
        Map<String, Object> info = new LinkedHashMap<>();
        Path path = Paths.get(filePath).toAbsolutePath().normalize();
        info.put("path", path.toString());
        info.put("exists", Files.exists(path));
        info.put("recordCount", recordCount(path, shape));
        return info;
    }

    private int recordCount(Path path, String shape) {
        if (!Files.exists(path)) return 0;
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            if ("array".equals(shape)) {
                List<?> list = mapper.readValue(path.toFile(), List.class);
                return list.size();
            }
            Map<?, ?> map = mapper.readValue(path.toFile(), Map.class);
            return map.size();
        } catch (Exception ignored) {
            return 0;
        }
    }
}
