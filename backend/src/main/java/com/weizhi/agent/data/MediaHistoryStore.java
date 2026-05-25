package com.weizhi.agent.data;

import java.util.List;
import java.util.Map;

public interface MediaHistoryStore {
    void appendImage(String prompt, String filename, String url, String model);
    void appendTts(String text, String voiceId, String model, String format, String audioUrl, boolean preview, String source);
    List<Map<String, Object>> getImageHistory();
    List<Map<String, Object>> getTtsHistory();
    boolean deleteImageHistory(String id);
    boolean deleteTtsHistory(String id);
    void clearImageHistory();
    void clearTtsHistory();
}
