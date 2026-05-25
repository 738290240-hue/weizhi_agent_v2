package com.weizhi.agent.data;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.weizhi.agent.config.PostgreSqlProperties;
import com.weizhi.agent.config.StorageProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.List;
import java.util.Map;
import java.util.Properties;

@Component
public class PostgreSqlSchemaInitializer implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(PostgreSqlSchemaInitializer.class);

    private final PostgreSqlProperties properties;
    private final JsonSettingsStore jsonSettingsStore;
    private final StorageProperties storageProperties;
    private final ObjectMapper objectMapper;

    public PostgreSqlSchemaInitializer(
            PostgreSqlProperties properties,
            JsonSettingsStore jsonSettingsStore,
            StorageProperties storageProperties,
            ObjectMapper objectMapper
    ) {
        this.properties = properties;
        this.jsonSettingsStore = jsonSettingsStore;
        this.storageProperties = storageProperties;
        this.objectMapper = objectMapper;
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

            // 4. Perform Data Migration
            migrateData(conn);
        } catch (Exception e) {
            log.error("Failed to initialize PostgreSQL schema: {}. Please check your Docker PostgreSQL container.", e.getMessage());
        }
    }

    private void migrateData(Connection conn) {
        try {
            // 1. Migrate settings
            if (isTableEmpty(conn, "weizhi_settings")) {
                Map<String, Object> jsonSettings = jsonSettingsStore.readStored();
                if (jsonSettings != null && !jsonSettings.isEmpty()) {
                    log.info("Migrating configuration settings from local JSON to PostgreSQL...");
                    String sql = "INSERT INTO weizhi_settings (provider, api_key, model, base_url, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)";
                    try (PreparedStatement ps = conn.prepareStatement(sql)) {
                        for (Map.Entry<String, Object> entry : jsonSettings.entrySet()) {
                            String provider = entry.getKey();
                            Object val = entry.getValue();
                            if (val instanceof Map<?, ?> map) {
                                Object apiObj = map.get("apiKey");
                                Object modelObj = map.get("model");
                                Object baseObj = map.get("baseUrl");

                                String apiKey = apiObj == null ? "" : String.valueOf(apiObj).trim();
                                String model = modelObj == null ? "" : String.valueOf(modelObj).trim();
                                String baseUrl = baseObj == null ? null : String.valueOf(baseObj).trim();

                                ps.setString(1, provider);
                                ps.setString(2, apiKey);
                                ps.setString(3, model);
                                ps.setString(4, baseUrl);
                                ps.addBatch();
                            }
                        }
                        ps.executeBatch();
                        log.info("Migrated settings successfully.");
                    }
                }
            }

            // 2. Migrate image history
            if (isTableEmpty(conn, "weizhi_image_history")) {
                Path path = Paths.get(storageProperties.getImageHistoryFile()).toAbsolutePath().normalize();
                if (Files.exists(path)) {
                    log.info("Migrating image history from local JSON to PostgreSQL...");
                    List<Map<String, Object>> imageList = objectMapper.readValue(path.toFile(), new TypeReference<List<Map<String, Object>>>() {});
                    if (imageList != null && !imageList.isEmpty()) {
                        String sql = "INSERT INTO weizhi_image_history (id, prompt, filename, url, model, created_at) VALUES (?, ?, ?, ?, ?, ?)";
                        try (PreparedStatement ps = conn.prepareStatement(sql)) {
                            for (Map<String, Object> item : imageList) {
                                String id = String.valueOf(item.getOrDefault("id", java.util.UUID.randomUUID().toString()));
                                String prompt = String.valueOf(item.getOrDefault("prompt", ""));
                                String filename = String.valueOf(item.getOrDefault("filename", ""));
                                String url = String.valueOf(item.getOrDefault("url", ""));
                                String model = String.valueOf(item.getOrDefault("model", ""));
                                String createdAt = String.valueOf(item.getOrDefault("createdAt", java.time.Instant.now().toString()));

                                ps.setString(1, id);
                                ps.setString(2, prompt);
                                ps.setString(3, filename);
                                ps.setString(4, url);
                                ps.setString(5, model);
                                ps.setString(6, createdAt);
                                ps.addBatch();
                            }
                            ps.executeBatch();
                            log.info("Migrated " + imageList.size() + " image history records successfully.");
                        }
                    }
                }
            }

            // 3. Migrate TTS history
            if (isTableEmpty(conn, "weizhi_tts_history")) {
                Path path = Paths.get(storageProperties.getTtsHistoryFile()).toAbsolutePath().normalize();
                if (Files.exists(path)) {
                    log.info("Migrating TTS history from local JSON to PostgreSQL...");
                    List<Map<String, Object>> ttsList = objectMapper.readValue(path.toFile(), new TypeReference<List<Map<String, Object>>>() {});
                    if (ttsList != null && !ttsList.isEmpty()) {
                        String sql = "INSERT INTO weizhi_tts_history (id, text, voice_id, model, format, audio_url, preview, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
                        try (PreparedStatement ps = conn.prepareStatement(sql)) {
                            for (Map<String, Object> item : ttsList) {
                                String id = String.valueOf(item.getOrDefault("id", java.util.UUID.randomUUID().toString()));
                                String text = String.valueOf(item.getOrDefault("text", ""));
                                String voiceId = String.valueOf(item.getOrDefault("voiceId", ""));
                                String model = String.valueOf(item.getOrDefault("model", ""));
                                String format = String.valueOf(item.getOrDefault("format", ""));
                                String audioUrl = String.valueOf(item.getOrDefault("audioUrl", ""));
                                boolean preview = Boolean.TRUE.equals(item.get("preview"));
                                String source = String.valueOf(item.getOrDefault("source", ""));
                                String createdAt = String.valueOf(item.getOrDefault("createdAt", java.time.Instant.now().toString()));

                                ps.setString(1, id);
                                ps.setString(2, text);
                                ps.setString(3, voiceId);
                                ps.setString(4, model);
                                ps.setString(5, format);
                                ps.setString(6, audioUrl);
                                ps.setBoolean(7, preview);
                                ps.setString(8, source);
                                ps.setString(9, createdAt);
                                ps.addBatch();
                            }
                            ps.executeBatch();
                            log.info("Migrated " + ttsList.size() + " TTS history records successfully.");
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to migrate JSON data to PostgreSQL database: {}", e.getMessage(), e);
        }
    }

    private boolean isTableEmpty(Connection conn, String tableName) {
        String query = "SELECT COUNT(*) FROM " + tableName;
        try (Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(query)) {
            if (rs.next()) {
                return rs.getInt(1) == 0;
            }
        } catch (Exception e) {
            log.warn("Failed to check if table '{}' is empty: {}", tableName, e.getMessage());
        }
        return true;
    }
}
