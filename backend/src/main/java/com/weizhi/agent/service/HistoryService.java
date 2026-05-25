package com.weizhi.agent.service;

import com.weizhi.agent.data.MediaHistoryStore;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class HistoryService {
    private final MediaHistoryStore mediaHistoryStore;

    public HistoryService(MediaHistoryStore mediaHistoryStore) {
        this.mediaHistoryStore = mediaHistoryStore;
    }

    public void appendImage(String prompt, String filename, String url, String model) {
        mediaHistoryStore.appendImage(prompt, filename, url, model);
    }

    public void appendTts(String text, String voiceId, String model, String format, String audioUrl, boolean preview, String source) {
        mediaHistoryStore.appendTts(text, voiceId, model, format, audioUrl, preview, source);
    }

    public List<Map<String, Object>> getImageHistory() {
        return mediaHistoryStore.getImageHistory();
    }

    public List<Map<String, Object>> getTtsHistory() {
        return mediaHistoryStore.getTtsHistory();
    }

    public boolean deleteImageHistory(String id) {
        return mediaHistoryStore.deleteImageHistory(id);
    }

    public boolean deleteTtsHistory(String id) {
        return mediaHistoryStore.deleteTtsHistory(id);
    }

    public void clearImageHistory() {
        mediaHistoryStore.clearImageHistory();
    }

    public void clearTtsHistory() {
        mediaHistoryStore.clearTtsHistory();
    }
}
