package com.weizhi.agent.data;

import com.weizhi.agent.config.StorageProperties;
import com.weizhi.agent.config.PostgreSqlProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.UUID;

@Component
public class PostgreSqlMediaHistoryStore implements MediaHistoryStore {
    private static final Logger log = LoggerFactory.getLogger(PostgreSqlMediaHistoryStore.class);

    private final PostgreSqlProperties properties;
    private final StorageProperties storageProperties;

    public PostgreSqlMediaHistoryStore(PostgreSqlProperties properties, StorageProperties storageProperties) {
        this.properties = properties;
        this.storageProperties = storageProperties;
    }

    private Properties connProps() {
        Properties connProps = new Properties();
        connProps.setProperty("user", properties.getUsername());
        connProps.setProperty("password", properties.getPassword());
        connProps.setProperty("connectTimeout", String.valueOf(properties.getConnectionTimeoutSeconds()));
        connProps.setProperty("socketTimeout", String.valueOf(properties.getConnectionTimeoutSeconds()));
        return connProps;
    }

    @Override
    public synchronized void appendImage(String prompt, String filename, String url, String model) {
        if (!properties.isEnabled()) return;

        String insertSql = "INSERT INTO weizhi_image_history (id, prompt, filename, url, model, created_at) " +
                "VALUES (?, ?, ?, ?, ?, ?)";
        try (Connection conn = DriverManager.getConnection(properties.jdbcUrl(), connProps())) {
            conn.setAutoCommit(false);
            try (PreparedStatement ps = conn.prepareStatement(insertSql)) {
                ps.setString(1, UUID.randomUUID().toString());
                ps.setString(2, prompt);
                ps.setString(3, filename);
                ps.setString(4, url);
                ps.setString(5, model);
                ps.setString(6, Instant.now().toString());
                ps.executeUpdate();
            }

            // Enforce limit of 200
            String purgeSql = "DELETE FROM weizhi_image_history WHERE id NOT IN (" +
                    "  SELECT id FROM weizhi_image_history ORDER BY created_at DESC LIMIT 200" +
                    ")";
            try (PreparedStatement purgePs = conn.prepareStatement(purgeSql)) {
                purgePs.executeUpdate();
            }
            conn.commit();
        } catch (Exception e) {
            log.error("Failed to append image history to PostgreSQL database: {}", e.getMessage());
        }
    }

    @Override
    public synchronized void appendTts(String text, String voiceId, String model, String format, String audioUrl, boolean preview, String source) {
        if (!properties.isEnabled()) return;

        String insertSql = "INSERT INTO weizhi_tts_history (id, text, voice_id, model, format, audio_url, preview, source, created_at) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = DriverManager.getConnection(properties.jdbcUrl(), connProps())) {
            conn.setAutoCommit(false);
            try (PreparedStatement ps = conn.prepareStatement(insertSql)) {
                ps.setString(1, UUID.randomUUID().toString());
                ps.setString(2, text);
                ps.setString(3, voiceId);
                ps.setString(4, model);
                ps.setString(5, format);
                ps.setString(6, audioUrl);
                ps.setBoolean(7, preview);
                ps.setString(8, source);
                ps.setString(9, Instant.now().toString());
                ps.executeUpdate();
            }

            // Enforce limit of 200
            String purgeSql = "DELETE FROM weizhi_tts_history WHERE id NOT IN (" +
                    "  SELECT id FROM weizhi_tts_history ORDER BY created_at DESC LIMIT 200" +
                    ")";
            try (PreparedStatement purgePs = conn.prepareStatement(purgeSql)) {
                purgePs.executeUpdate();
            }
            conn.commit();
        } catch (Exception e) {
            log.error("Failed to append TTS history to PostgreSQL database: {}", e.getMessage());
        }
    }

    @Override
    public synchronized List<Map<String, Object>> getImageHistory() {
        List<Map<String, Object>> histories = new ArrayList<>();
        if (!properties.isEnabled()) return histories;

        String query = "SELECT id, prompt, filename, url, model, created_at FROM weizhi_image_history ORDER BY created_at DESC";
        try (Connection conn = DriverManager.getConnection(properties.jdbcUrl(), connProps());
             PreparedStatement ps = conn.prepareStatement(query);
             ResultSet rs = ps.executeQuery()) {

            while (rs.next()) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", rs.getString("id"));
                item.put("prompt", rs.getString("prompt"));
                item.put("filename", rs.getString("filename"));
                item.put("url", rs.getString("url"));
                item.put("model", rs.getString("model"));
                item.put("createdAt", rs.getString("created_at"));
                histories.add(item);
            }
        } catch (Exception e) {
            log.error("Failed to fetch image history from PostgreSQL database: {}", e.getMessage());
        }
        return histories;
    }

    @Override
    public synchronized List<Map<String, Object>> getTtsHistory() {
        List<Map<String, Object>> histories = new ArrayList<>();
        if (!properties.isEnabled()) return histories;

        String query = "SELECT id, text, voice_id, model, format, audio_url, preview, source, created_at FROM weizhi_tts_history ORDER BY created_at DESC";
        try (Connection conn = DriverManager.getConnection(properties.jdbcUrl(), connProps());
             PreparedStatement ps = conn.prepareStatement(query);
             ResultSet rs = ps.executeQuery()) {

            while (rs.next()) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", rs.getString("id"));
                item.put("text", rs.getString("text"));
                item.put("voiceId", rs.getString("voice_id"));
                item.put("model", rs.getString("model"));
                item.put("format", rs.getString("format"));
                item.put("audioUrl", rs.getString("audio_url"));
                item.put("preview", rs.getBoolean("preview"));
                item.put("source", rs.getString("source"));
                item.put("createdAt", rs.getString("created_at"));
                histories.add(item);
            }
        } catch (Exception e) {
            log.error("Failed to fetch TTS history from PostgreSQL database: {}", e.getMessage());
        }
        return histories;
    }

    @Override
    public synchronized boolean deleteImageHistory(String id) {
        if (!properties.isEnabled()) return false;

        String findSql = "SELECT filename FROM weizhi_image_history WHERE id = ?";
        String deleteSql = "DELETE FROM weizhi_image_history WHERE id = ?";

        try (Connection conn = DriverManager.getConnection(properties.jdbcUrl(), connProps())) {
            conn.setAutoCommit(false);
            String filename = null;
            try (PreparedStatement findPs = conn.prepareStatement(findSql)) {
                findPs.setString(1, id);
                try (ResultSet rs = findPs.executeQuery()) {
                    if (rs.next()) {
                        filename = rs.getString("filename");
                    }
                }
            }

            if (filename == null) {
                conn.rollback();
                return false;
            }

            // Delete physical file
            deletePhysicalFile(storageProperties.getImageDir(), filename);
            deletePhysicalFile("generated_images", filename);

            int deletedRows;
            try (PreparedStatement deletePs = conn.prepareStatement(deleteSql)) {
                deletePs.setString(1, id);
                deletedRows = deletePs.executeUpdate();
            }

            conn.commit();
            return deletedRows > 0;
        } catch (Exception e) {
            log.error("Failed to delete image history record: {}", e.getMessage());
            return false;
        }
    }

    @Override
    public synchronized boolean deleteTtsHistory(String id) {
        if (!properties.isEnabled()) return false;

        String findSql = "SELECT audio_url FROM weizhi_tts_history WHERE id = ?";
        String deleteSql = "DELETE FROM weizhi_tts_history WHERE id = ?";

        try (Connection conn = DriverManager.getConnection(properties.jdbcUrl(), connProps())) {
            conn.setAutoCommit(false);
            String audioUrl = null;
            try (PreparedStatement findPs = conn.prepareStatement(findSql)) {
                findPs.setString(1, id);
                try (ResultSet rs = findPs.executeQuery()) {
                    if (rs.next()) {
                        audioUrl = rs.getString("audio_url");
                    }
                }
            }

            if (audioUrl == null) {
                conn.rollback();
                return false;
            }

            // Delete physical file
            String audioFilename = audioUrl.contains("/") ? audioUrl.substring(audioUrl.lastIndexOf('/') + 1) : audioUrl;
            deletePhysicalFile(storageProperties.getAudioDir(), audioFilename);

            int deletedRows;
            try (PreparedStatement deletePs = conn.prepareStatement(deleteSql)) {
                deletePs.setString(1, id);
                deletedRows = deletePs.executeUpdate();
            }

            conn.commit();
            return deletedRows > 0;
        } catch (Exception e) {
            log.error("Failed to delete TTS history record: {}", e.getMessage());
            return false;
        }
    }

    @Override
    public synchronized void clearImageHistory() {
        if (!properties.isEnabled()) return;
        executeSql("TRUNCATE TABLE weizhi_image_history");
    }

    @Override
    public synchronized void clearTtsHistory() {
        if (!properties.isEnabled()) return;
        executeSql("TRUNCATE TABLE weizhi_tts_history");
    }

    private void executeSql(String sql) {
        try (Connection conn = DriverManager.getConnection(properties.jdbcUrl(), connProps());
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.executeUpdate();
        } catch (Exception e) {
            log.error("Failed to execute SQL '{}': {}", sql, e.getMessage());
        }
    }

    private void deletePhysicalFile(String directory, String filename) {
        try {
            Path dir = Paths.get(directory).toAbsolutePath().normalize();
            Path file = dir.resolve(filename).normalize();
            if (!file.startsWith(dir)) {
                log.warn("Path traversal attempt blocked: {} not inside {}", file, dir);
                return;
            }
            if (Files.exists(file)) {
                Files.delete(file);
                log.info("Deleted physical file: {}", file);
            }
        } catch (IOException e) {
            log.warn("Failed to delete physical file {}/{}: {}", directory, filename, e.getMessage());
        }
    }
}
