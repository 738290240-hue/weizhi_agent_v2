package com.weizhi.agent.data;

import com.weizhi.agent.config.PostgreSqlProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Properties;

@Component
public class PostgreSqlSettingsStore implements SettingsStore {
    private static final Logger log = LoggerFactory.getLogger(PostgreSqlSettingsStore.class);

    private final PostgreSqlProperties properties;

    public PostgreSqlSettingsStore(PostgreSqlProperties properties) {
        this.properties = properties;
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
    public Map<String, Object> readStored() {
        Map<String, Object> result = new LinkedHashMap<>();
        if (!properties.isEnabled()) return result;

        String query = "SELECT provider, api_key, model, base_url FROM weizhi_settings";
        try (Connection conn = DriverManager.getConnection(properties.jdbcUrl(), connProps());
             PreparedStatement ps = conn.prepareStatement(query);
             ResultSet rs = ps.executeQuery()) {

            while (rs.next()) {
                String provider = rs.getString("provider");
                String apiKey = rs.getString("api_key");
                String model = rs.getString("model");
                String baseUrl = rs.getString("base_url");

                Map<String, Object> providerData = new LinkedHashMap<>();
                providerData.put("apiKey", apiKey == null ? "" : apiKey);
                providerData.put("model", model == null ? "" : model);
                if (baseUrl != null) {
                    providerData.put("baseUrl", baseUrl);
                }
                result.put(provider, providerData);
            }
        } catch (Exception e) {
            log.error("Failed to read settings from PostgreSQL database: {}", e.getMessage());
        }
        return result;
    }

    @Override
    @SuppressWarnings("unchecked")
    public void writeStored(Map<String, Object> settings) {
        if (!properties.isEnabled()) return;

        String sql = "INSERT INTO weizhi_settings (provider, api_key, model, base_url, updated_at) " +
                "VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) " +
                "ON CONFLICT (provider) DO UPDATE SET " +
                "  api_key = EXCLUDED.api_key, " +
                "  model = EXCLUDED.model, " +
                "  base_url = EXCLUDED.base_url, " +
                "  updated_at = CURRENT_TIMESTAMP";

        try (Connection conn = DriverManager.getConnection(properties.jdbcUrl(), connProps());
             PreparedStatement ps = conn.prepareStatement(sql)) {

            for (Map.Entry<String, Object> entry : settings.entrySet()) {
                String provider = entry.getKey();
                Object val = entry.getValue();
                if (!(val instanceof Map<?, ?>)) continue;

                Map<String, Object> providerData = (Map<String, Object>) val;
                String apiKey = String.valueOf(providerData.getOrDefault("apiKey", "")).trim();
                String model = String.valueOf(providerData.getOrDefault("model", "")).trim();
                String baseUrl = providerData.containsKey("baseUrl") ? String.valueOf(providerData.get("baseUrl")).trim() : null;

                ps.setString(1, provider);
                ps.setString(2, apiKey);
                ps.setString(3, model);
                ps.setString(4, baseUrl);
                ps.addBatch();
            }
            ps.executeBatch();
        } catch (Exception e) {
            log.error("Failed to write settings to PostgreSQL database: {}", e.getMessage(), e);
        }
    }
}
