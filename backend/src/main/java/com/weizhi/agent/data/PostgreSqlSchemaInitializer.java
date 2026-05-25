package com.weizhi.agent.data;

import com.weizhi.agent.config.PostgreSqlProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.Properties;

@Component
public class PostgreSqlSchemaInitializer implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(PostgreSqlSchemaInitializer.class);

    private final PostgreSqlProperties properties;

    public PostgreSqlSchemaInitializer(PostgreSqlProperties properties) {
        this.properties = properties;
    }

    @Override
    public void run(String... args) {
        if (!properties.isEnabled()) {
            log.info("PostgreSQL is disabled in configuration. Skipping database schema initialization.");
            return;
        }

        log.info("Initializing PostgreSQL schema at {}...", properties.jdbcUrl());

        Properties connProps = new Properties();
        connProps.setProperty("user", properties.getUsername());
        connProps.setProperty("password", properties.getPassword());
        connProps.setProperty("connectTimeout", String.valueOf(properties.getConnectionTimeoutSeconds()));
        connProps.setProperty("socketTimeout", String.valueOf(properties.getConnectionTimeoutSeconds()));

        try (Connection conn = DriverManager.getConnection(properties.jdbcUrl(), connProps);
             Statement stmt = conn.createStatement()) {

            // 1. Settings Table
            stmt.execute("CREATE TABLE IF NOT EXISTS weizhi_settings (" +
                    "provider VARCHAR(50) PRIMARY KEY, " +
                    "api_key VARCHAR(500), " +
                    "model VARCHAR(100), " +
                    "base_url VARCHAR(500), " +
                    "updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP" +
                    ")");
            log.info("Initialized table 'weizhi_settings'.");

            // 2. Image History Table
            stmt.execute("CREATE TABLE IF NOT EXISTS weizhi_image_history (" +
                    "id VARCHAR(50) PRIMARY KEY, " +
                    "prompt TEXT, " +
                    "filename VARCHAR(255), " +
                    "url VARCHAR(500), " +
                    "model VARCHAR(100), " +
                    "created_at VARCHAR(50)" +
                    ")");
            log.info("Initialized table 'weizhi_image_history'.");

            // 3. TTS History Table
            stmt.execute("CREATE TABLE IF NOT EXISTS weizhi_tts_history (" +
                    "id VARCHAR(50) PRIMARY KEY, " +
                    "text TEXT, " +
                    "voice_id VARCHAR(100), " +
                    "model VARCHAR(100), " +
                    "format VARCHAR(20), " +
                    "audio_url VARCHAR(500), " +
                    "preview BOOLEAN, " +
                    "source VARCHAR(50), " +
                    "created_at VARCHAR(50)" +
                    ")");
            log.info("Initialized table 'weizhi_tts_history'.");

            log.info("PostgreSQL database schema initialization completed successfully.");
        } catch (Exception e) {
            log.error("Failed to initialize PostgreSQL schema: {}. Please check your Docker PostgreSQL container.", e.getMessage());
        }
    }
}
