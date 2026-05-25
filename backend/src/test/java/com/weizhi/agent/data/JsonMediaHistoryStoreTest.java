package com.weizhi.agent.data;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.weizhi.agent.config.StorageProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class JsonMediaHistoryStoreTest {
    @TempDir
    Path tempDir;

    private JsonMediaHistoryStore newStore() {
        StorageProperties properties = new StorageProperties();
        properties.setImageDir(tempDir.resolve("images").toString());
        properties.setAudioDir(tempDir.resolve("audio").toString());
        properties.setImageHistoryFile(tempDir.resolve("data").resolve("image-history.json").toString());
        properties.setTtsHistoryFile(tempDir.resolve("data").resolve("tts-history.json").toString());
        return new JsonMediaHistoryStore(properties, new ObjectMapper());
    }

    @Test
    void appendImage_andGetImageHistory_roundTripsRecord() {
        JsonMediaHistoryStore store = newStore();

        store.appendImage("a prompt", "image.png", "/api/images/files/image.png", "image-01");

        List<Map<String, Object>> histories = store.getImageHistory();
        Map<String, Object> match = histories.stream()
                .filter(item -> "a prompt".equals(item.get("prompt")))
                .findFirst()
                .orElse(null);

        assertNotNull(match);
        assertEquals("image.png", match.get("filename"));
    }

    @Test
    void appendTts_andDeleteTtsHistory_updatesHistoryFile() {
        JsonMediaHistoryStore store = newStore();

        store.appendTts("hello", "voice", "speech-2.8-hd", "mp3", "/api/tts/audio/a.mp3", false, "manual");
        String id = String.valueOf(store.getTtsHistory().get(0).get("id"));

        assertTrue(store.deleteTtsHistory(id));
        assertTrue(store.getTtsHistory().isEmpty());
    }
}
