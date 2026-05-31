package com.weizhi.agent.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import okhttp3.Call;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Protocol;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;
import org.junit.jupiter.api.Test;

import java.io.IOException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class GeminiModelProbeServiceTest {

    @Test
    void testFallbackModelIdsOnProbeFailure() throws IOException {
        AiSettingsService settingsService = mock(AiSettingsService.class);
        when(settingsService.apiKey("gemini")).thenReturn("test-key");
        when(settingsService.geminiBaseUrl()).thenReturn("http://127.0.0.1:8045/v1");

        OkHttpClient httpClient = mock(OkHttpClient.class);
        Call call = mock(Call.class);
        Response failedResponse = new Response.Builder()
                .request(new Request.Builder().url("http://127.0.0.1:8045/v1/models").build())
                .protocol(Protocol.HTTP_1_1)
                .code(500)
                .message("Internal Server Error")
                .body(ResponseBody.create("", MediaType.parse("application/json")))
                .build();
        when(call.execute()).thenReturn(failedResponse);
        when(httpClient.newCall(any())).thenReturn(call);

        OkHttpClient.Builder builder = mock(OkHttpClient.Builder.class);
        when(httpClient.newBuilder()).thenReturn(builder);
        when(builder.connectTimeout(any(Long.class), any())).thenReturn(builder);
        when(builder.readTimeout(any(Long.class), any())).thenReturn(builder);
        when(builder.writeTimeout(any(Long.class), any())).thenReturn(builder);
        when(builder.build()).thenReturn(httpClient);

        ObjectMapper objectMapper = new ObjectMapper();

        GeminiModelProbeService probeService = new GeminiModelProbeService(settingsService, httpClient, objectMapper);
        GeminiCapabilitiesResult result = probeService.probe();

        assertNotNull(result);
        assertEquals("http://127.0.0.1:8045/v1", result.getBaseUrl());
        assertFalse(result.getModels().isEmpty());
        
        boolean hasStable = result.getModels().stream().anyMatch(m -> "stable".equals(m.getGroup()));
        assertTrue(hasStable);
    }
}
