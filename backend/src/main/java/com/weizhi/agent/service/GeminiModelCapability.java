package com.weizhi.agent.service;

public class GeminiModelCapability {
    private String id;
    private String group; // stable, advancedClaude, geminiText, gptText, disabled
    private boolean available;
    private int statusCode;
    private String errorType; // ok, not_found, quota_exhausted, invalid_argument, timeout, unknown
    private String mappedModel;
    private String accountEmail;
    private long latencyMs;
    private String recommendedUse;

    public GeminiModelCapability() {}

    public GeminiModelCapability(String id, String group, boolean available, int statusCode, String errorType,
                                 String mappedModel, String accountEmail, long latencyMs, String recommendedUse) {
        this.id = id;
        this.group = group;
        this.available = available;
        this.statusCode = statusCode;
        this.errorType = errorType;
        this.mappedModel = mappedModel;
        this.accountEmail = accountEmail;
        this.latencyMs = latencyMs;
        this.recommendedUse = recommendedUse;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getGroup() {
        return group;
    }

    public void setGroup(String group) {
        this.group = group;
    }

    public boolean isAvailable() {
        return available;
    }

    public void setAvailable(boolean available) {
        this.available = available;
    }

    public int getStatusCode() {
        return statusCode;
    }

    public void setStatusCode(int statusCode) {
        this.statusCode = statusCode;
    }

    public String getErrorType() {
        return errorType;
    }

    public void setErrorType(String errorType) {
        this.errorType = errorType;
    }

    public String getMappedModel() {
        return mappedModel;
    }

    public void setMappedModel(String mappedModel) {
        this.mappedModel = mappedModel;
    }

    public String getAccountEmail() {
        return accountEmail;
    }

    public void setAccountEmail(String accountEmail) {
        this.accountEmail = accountEmail;
    }

    public long getLatencyMs() {
        return latencyMs;
    }

    public void setLatencyMs(long latencyMs) {
        this.latencyMs = latencyMs;
    }

    public String getRecommendedUse() {
        return recommendedUse;
    }

    public void setRecommendedUse(String recommendedUse) {
        this.recommendedUse = recommendedUse;
    }
}
