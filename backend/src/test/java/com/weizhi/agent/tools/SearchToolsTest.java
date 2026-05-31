package com.weizhi.agent.tools;

import com.fasterxml.jackson.databind.ObjectMapper;
import okhttp3.OkHttpClient;
import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import static org.junit.jupiter.api.Assertions.*;

public class SearchToolsTest {

    @Test
    public void testSearchFallbackFlow() {
        OkHttpClient httpClient = new OkHttpClient();
        ObjectMapper objectMapper = new ObjectMapper();
        SearchTools searchTools = new SearchTools(httpClient, objectMapper);

        // Under local test environment without API Keys, it should fall back gracefully
        String query = "2026年今日新闻";
        String result = searchTools.search(query);

        assertNotNull(result);
        assertTrue(result.contains("🔍 Web Search Results"));
        assertTrue(result.contains("兜底"));
        
        // Check that current system date is correctly injected in fallback
        LocalDate now = LocalDate.now();
        String expectedDate = now.format(DateTimeFormatter.ofPattern("yyyy年MM月dd日"));
        assertTrue(result.contains(expectedDate), "Fallback context must inject correct current system date: " + expectedDate);
        assertTrue(result.contains(query), "Fallback context must include the original query: " + query);
    }
}
