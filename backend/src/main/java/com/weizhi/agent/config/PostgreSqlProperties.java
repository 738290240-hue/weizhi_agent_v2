package com.weizhi.agent.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "weizhi.postgresql")
public class PostgreSqlProperties {
    private boolean enabled = true;
    private String host = "localhost";
    private int port = 5432;
    private String database = "weizhi";
    private String username = "weizhi";
    private String password = "weizhi_password";
    private int connectionTimeoutSeconds = 3;

    public String jdbcUrl() {
        return "jdbc:postgresql://" + host + ":" + port + "/" + database;
    }
}
