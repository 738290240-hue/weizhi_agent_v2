package com.weizhi.agent.service;

import com.weizhi.agent.config.PostgreSqlProperties;
import org.springframework.stereotype.Service;

import java.sql.Connection;
import java.sql.DriverManager;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Properties;

@Service
public class JdbcPostgreSqlConnectionProbe implements PostgreSqlConnectionProbe {
    private final PostgreSqlProperties properties;

    public JdbcPostgreSqlConnectionProbe(PostgreSqlProperties properties) {
        this.properties = properties;
    }

    @Override
    public Map<String, Object> status() {
        Map<String, Object> status = baseStatus();
        if (!properties.isEnabled()) {
            status.put("available", false);
            status.put("ready", false);
            status.put("message", "PostgreSQL connection is disabled.");
            return status;
        }

        Map<String, Object> test = testConnection();
        status.put("available", test.get("success"));
        status.put("ready", test.get("success"));
        status.put("message", test.get("message"));
        return status;
    }

    @Override
    public Map<String, Object> testConnection() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("mode", "postgresql");
        if (!properties.isEnabled()) {
            result.put("success", false);
            result.put("message", "PostgreSQL connection is disabled.");
            return result;
        }

        try (Connection connection = DriverManager.getConnection(properties.jdbcUrl(), connectionProperties())) {
            result.put("success", connection.isValid(properties.getConnectionTimeoutSeconds()));
            result.put("message", Boolean.TRUE.equals(result.get("success"))
                    ? "PostgreSQL connection is available."
                    : "PostgreSQL connection is not valid.");
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", "PostgreSQL connection failed: " + e.getMessage());
        }
        return result;
    }

    private Map<String, Object> baseStatus() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("configured", properties.isEnabled());
        status.put("available", false);
        status.put("ready", false);
        status.put("host", properties.getHost());
        status.put("port", properties.getPort());
        status.put("database", properties.getDatabase());
        status.put("username", properties.getUsername());
        status.put("jdbcUrl", properties.jdbcUrl());
        return status;
    }

    private Properties connectionProperties() {
        Properties connectionProperties = new Properties();
        connectionProperties.setProperty("user", properties.getUsername());
        connectionProperties.setProperty("password", properties.getPassword());
        connectionProperties.setProperty("connectTimeout", String.valueOf(properties.getConnectionTimeoutSeconds()));
        connectionProperties.setProperty("socketTimeout", String.valueOf(properties.getConnectionTimeoutSeconds()));
        return connectionProperties;
    }
}
