package com.weizhi.agent.service;

import java.util.List;

public class GeminiCapabilitiesResult {
    private String baseUrl;
    private String checkedAt;
    private String accountEmail;
    private List<GeminiModelCapability> models;

    public GeminiCapabilitiesResult() {}

    public GeminiCapabilitiesResult(String baseUrl, String checkedAt, String accountEmail, List<GeminiModelCapability> models) {
        this.baseUrl = baseUrl;
        this.checkedAt = checkedAt;
        this.accountEmail = accountEmail;
        this.models = models;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getCheckedAt() {
        return checkedAt;
    }

    public void setCheckedAt(String checkedAt) {
        this.checkedAt = checkedAt;
    }

    public String getAccountEmail() {
        return accountEmail;
    }

    public void setAccountEmail(String accountEmail) {
        this.accountEmail = accountEmail;
    }

    public List<GeminiModelCapability> getModels() {
        return models;
    }

    public void setModels(List<GeminiModelCapability> models) {
        this.models = models;
    }
}
