package com.weizhi.agent.data;

import com.weizhi.agent.config.PostgreSqlProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PostgreSqlSettingsStoreTest {
    private PostgreSqlProperties properties;
    private PostgreSqlSettingsStore store;

    @BeforeEach
    void setUp() {
        properties = mock(PostgreSqlProperties.class);
        store = new PostgreSqlSettingsStore(properties);
    }

    @Test
    void testReadStoredWhenDisabled() {
        when(properties.isEnabled()).thenReturn(false);
        Map<String, Object> result = store.readStored();
        assertTrue(result.isEmpty());
    }

    @Test
    void testWriteStoredWhenDisabled() {
        when(properties.isEnabled()).thenReturn(false);
        Map<String, Object> settings = new LinkedHashMap<>();
        assertDoesNotThrow(() -> store.writeStored(settings));
    }
}
