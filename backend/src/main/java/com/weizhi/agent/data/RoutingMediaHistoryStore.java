package com.weizhi.agent.data;

import com.weizhi.agent.service.DataManagementService;
import org.springframework.context.annotation.Lazy;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Primary
@Component
public class RoutingMediaHistoryStore implements MediaHistoryStore {
    private final JsonMediaHistoryStore jsonStore;
    private final PostgreSqlMediaHistoryStore postgresStore;
    private final DataManagementService dataManagementService;

    public RoutingMediaHistoryStore(
            JsonMediaHistoryStore jsonStore,
            PostgreSqlMediaHistoryStore postgresStore,
            @Lazy DataManagementService dataManagementService
    ) {
        this.jsonStore = jsonStore;
        this.postgresStore = postgresStore;
        this.dataManagementService = dataManagementService;
    }

    private MediaHistoryStore activeStore() {
        if (dataManagementService.getMode() == DataSourceMode.POSTGRESQL) {
            return postgresStore;
        }
        return jsonStore;
    }

    @Override
    public void appendImage(String prompt, String filename, String url, String model) {
        activeStore().appendImage(prompt, filename, url, model);
    }

    @Override
    public void appendTts(String text, String voiceId, String model, String format, String audioUrl, boolean preview, String source) {
        activeStore().appendTts(text, voiceId, model, format, audioUrl, preview, source);
    }

    @Override
    public List<Map<String, Object>> getImageHistory() {
        return activeStore().getImageHistory();
    }

    @Override
    public List<Map<String, Object>> getTtsHistory() {
        return activeStore().getTtsHistory();
    }

    @Override
    public boolean deleteImageHistory(String id) {
        return activeStore().deleteImageHistory(id);
    }

    @Override
    public boolean deleteTtsHistory(String id) {
        return activeStore().deleteTtsHistory(id);
    }

    @Override
    public void clearImageHistory() {
        activeStore().clearImageHistory();
    }

    @Override
    public void clearTtsHistory() {
        activeStore().clearTtsHistory();
    }
}
