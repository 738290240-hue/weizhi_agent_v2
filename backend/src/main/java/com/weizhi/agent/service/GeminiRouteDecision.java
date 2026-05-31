package com.weizhi.agent.service;

public class GeminiRouteDecision {
    private String mode;
    private String model;
    private String protocol;
    private String reason;
    private String fallbackMessage;

    public GeminiRouteDecision() {}

    public GeminiRouteDecision(String mode, String model, String protocol, String reason, String fallbackMessage) {
        this.mode = mode;
        this.model = model;
        this.protocol = protocol;
        this.reason = reason;
        this.fallbackMessage = fallbackMessage;
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public String getProtocol() {
        return protocol;
    }

    public void setProtocol(String protocol) {
        this.protocol = protocol;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getFallbackMessage() {
        return fallbackMessage;
    }

    public void setFallbackMessage(String fallbackMessage) {
        this.fallbackMessage = fallbackMessage;
    }
}
