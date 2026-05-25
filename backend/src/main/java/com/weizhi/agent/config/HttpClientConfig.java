package com.weizhi.agent.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import okhttp3.OkHttpClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

/**
 * Shared HTTP client and JSON mapper beans to avoid duplicate instantiation across controllers and services.
 */
@Configuration
public class HttpClientConfig {

    @Bean
    public OkHttpClient okHttpClient() {
        okhttp3.OkHttpClient.Builder builder = new okhttp3.OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .writeTimeout(60, TimeUnit.SECONDS)
                .readTimeout(180, TimeUnit.SECONDS);

        // Support HTTP/HTTPS proxy environment variables (very common in developer environments)
        String proxyEnv = System.getenv("HTTPS_PROXY");
        if (proxyEnv == null || proxyEnv.isEmpty()) {
            proxyEnv = System.getenv("https_proxy");
        }
        if (proxyEnv == null || proxyEnv.isEmpty()) {
            proxyEnv = System.getenv("HTTP_PROXY");
        }
        if (proxyEnv == null || proxyEnv.isEmpty()) {
            proxyEnv = System.getenv("http_proxy");
        }

        if (proxyEnv != null && !proxyEnv.isEmpty()) {
            try {
                String rawUrl = proxyEnv;
                if (rawUrl.startsWith("http://")) {
                    rawUrl = rawUrl.substring(7);
                } else if (rawUrl.startsWith("https://")) {
                    rawUrl = rawUrl.substring(8);
                }
                int colonIdx = rawUrl.indexOf(':');
                String host;
                int port;
                if (colonIdx > 0) {
                    host = rawUrl.substring(0, colonIdx);
                    port = Integer.parseInt(rawUrl.substring(colonIdx + 1));
                } else {
                    host = rawUrl;
                    port = 80;
                }
                builder.proxy(new java.net.Proxy(java.net.Proxy.Type.HTTP, new java.net.InetSocketAddress(host, port)));
                System.out.println("[OkHttpClient] Configured with environment proxy: " + host + ":" + port);
            } catch (Exception e) {
                System.err.println("[OkHttpClient] Failed to parse proxy environment variable '" + proxyEnv + "': " + e.getMessage());
            }
        }

        return builder.build();
    }

    @Bean
    public ObjectMapper objectMapper() {
        ObjectMapper objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        return objectMapper;
    }
}

