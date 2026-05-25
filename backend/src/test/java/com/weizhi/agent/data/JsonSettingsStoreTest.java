package com.weizhi.agent.data;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class JsonSettingsStoreTest {
    @TempDir
    Path tempDir;

    @Test
    void readStored_returnsEmptyMapWhenFileDoesNotExist() {
        JsonSettingsStore store = new JsonSettingsStore(new ObjectMapper());
        store.setSettingsFile(tempDir.resolve("missing-settings.json").toString());

        Map<String, Object> result = store.readStored();

        assertTrue(result.isEmpty());
    }

    @Test
    void writeStored_createsParentDirectoriesAndPersistsSettings() throws Exception {
        Path settingsFile = tempDir.resolve("nested").resolve("ai-settings.json");
        JsonSettingsStore store = new JsonSettingsStore(new ObjectMapper());
        store.setSettingsFile(settingsFile.toString());

        Map<String, Object> provider = new LinkedHashMap<>();
        provider.put("apiKey", "test-key");
        provider.put("model", "test-model");
        Map<String, Object> settings = new LinkedHashMap<>();
        settings.put("minimax", provider);

        store.writeStored(settings);

        assertTrue(Files.exists(settingsFile));
        Map<String, Object> reread = store.readStored();
        assertEquals("test-model", ((Map<?, ?>) reread.get("minimax")).get("model"));
    }
}
