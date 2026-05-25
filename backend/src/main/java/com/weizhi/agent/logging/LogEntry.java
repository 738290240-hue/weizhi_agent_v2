package com.weizhi.agent.logging;

import lombok.Data;

import java.time.Instant;

@Data
public class LogEntry {
    private String id;
    private Instant timestamp;
    private String level;
    private String logger;
    private String thread;
    private String message;
}
