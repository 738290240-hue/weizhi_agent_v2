package com.weizhi.agent.service;

import java.util.Map;

public interface PostgreSqlConnectionProbe {
    Map<String, Object> status();
    Map<String, Object> testConnection();
}
