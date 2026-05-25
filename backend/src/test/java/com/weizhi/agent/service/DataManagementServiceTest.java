package com.weizhi.agent.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.weizhi.agent.config.StorageProperties;
import com.weizhi.agent.data.JsonSettingsStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class DataManagementServiceTest {
    @TempDir
    Path tempDir;

    @Test
    void status_includesPostgresqlConnectionStatus() {
        DataManagementService service = newService(fakeProbe(
                Map.of(
                        "configured", true,
                        "available", false,
                        "ready", false,
                        "host", "localhost",
                        "port", 5432,
                        "database", "weizhi",
                        "message", "PostgreSQL is configured but not connected."
                ),
                Map.of()
        ));

        Map<String, Object> status = service.status();
        Map<?, ?> postgresql = (Map<?, ?>) status.get("postgresql");

        assertEquals(true, postgresql.get("configured"));
        assertEquals(false, postgresql.get("ready"));
        assertEquals("localhost", postgresql.get("host"));
        assertEquals(5432, postgresql.get("port"));
        assertEquals("weizhi", postgresql.get("database"));
    }

    @Test
    void testConnection_usesPostgresqlProbeForPostgresqlMode() {
        DataManagementService service = newService(fakeProbe(
                Map.of(),
                Map.of(
                        "success", true,
                        "mode", "postgresql",
                        "message", "PostgreSQL connection is available."
                )
        ));

        Map<String, Object> result = service.testConnection("postgresql");

        assertEquals(true, result.get("success"));
        assertEquals("postgresql", result.get("mode"));
        assertEquals("PostgreSQL connection is available.", result.get("message"));
    }

    private DataManagementService newService(PostgreSqlConnectionProbe probe) {
        JsonSettingsStore settingsStore = new JsonSettingsStore(new ObjectMapper());
        settingsStore.setSettingsFile(tempDir.resolve("data").resolve("ai-settings.json").toString());

        StorageProperties storageProperties = new StorageProperties();
        storageProperties.setImageHistoryFile(tempDir.resolve("data").resolve("image-history.json").toString());
        storageProperties.setTtsHistoryFile(tempDir.resolve("data").resolve("tts-history.json").toString());

        return new DataManagementService(settingsStore, storageProperties, probe, "json");
    }

    private PostgreSqlConnectionProbe fakeProbe(Map<String, Object> status, Map<String, Object> testResult) {
        return new PostgreSqlConnectionProbe() {
            @Override
            public Map<String, Object> status() {
                return new LinkedHashMap<>(status);
            }

            @Override
            public Map<String, Object> testConnection() {
                return new LinkedHashMap<>(testResult);
            }
        };
    }
}
