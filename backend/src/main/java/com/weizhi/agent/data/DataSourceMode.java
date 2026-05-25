package com.weizhi.agent.data;

public enum DataSourceMode {
    JSON("json"),
    POSTGRESQL("postgresql");

    private final String value;

    DataSourceMode(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    public static DataSourceMode from(String raw) {
        if (raw == null) return JSON;
        String normalized = raw.trim().toLowerCase();
        for (DataSourceMode mode : values()) {
            if (mode.value.equals(normalized)) return mode;
        }
        return JSON;
    }
}
