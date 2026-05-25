package com.weizhi.agent.data;

import java.util.Map;

public interface SettingsStore {
    Map<String, Object> readStored();
    void writeStored(Map<String, Object> settings);
}
