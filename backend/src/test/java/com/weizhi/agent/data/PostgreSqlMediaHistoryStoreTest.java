package com.weizhi.agent.data;

import com.weizhi.agent.config.StorageProperties;
import com.weizhi.agent.config.PostgreSqlProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PostgreSqlMediaHistoryStoreTest {
    private PostgreSqlProperties postgreSqlProperties;
    private StorageProperties storageProperties;
    private PostgreSqlMediaHistoryStore store;

    @BeforeEach
    void setUp() {
        postgreSqlProperties = mock(PostgreSqlProperties.class);
        storageProperties = mock(StorageProperties.class);
        store = new PostgreSqlMediaHistoryStore(postgreSqlProperties, storageProperties);
    }

    @Test
    void testGetImageHistoryWhenDisabled() {
        when(postgreSqlProperties.isEnabled()).thenReturn(false);
        List<Map<String, Object>> result = store.getImageHistory();
        assertTrue(result.isEmpty());
    }

    @Test
    void testGetTtsHistoryWhenDisabled() {
        when(postgreSqlProperties.isEnabled()).thenReturn(false);
        List<Map<String, Object>> result = store.getTtsHistory();
        assertTrue(result.isEmpty());
    }

    @Test
    void testAppendImageWhenDisabled() {
        when(postgreSqlProperties.isEnabled()).thenReturn(false);
        assertDoesNotThrow(() -> store.appendImage("prompt", "file.png", "/url", "model"));
    }

    @Test
    void testAppendTtsWhenDisabled() {
        when(postgreSqlProperties.isEnabled()).thenReturn(false);
        assertDoesNotThrow(() -> store.appendTts("text", "voice", "model", "mp3", "/audio", false, "local"));
    }

    @Test
    void testDeleteImageHistoryWhenDisabled() {
        when(postgreSqlProperties.isEnabled()).thenReturn(false);
        assertFalse(store.deleteImageHistory("some-id"));
    }

    @Test
    void testDeleteTtsHistoryWhenDisabled() {
        when(postgreSqlProperties.isEnabled()).thenReturn(false);
        assertFalse(store.deleteTtsHistory("some-id"));
    }
}
