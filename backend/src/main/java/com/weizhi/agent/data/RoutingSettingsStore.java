package com.weizhi.agent.data;

import com.weizhi.agent.service.DataManagementService;
import org.springframework.context.annotation.Lazy;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.util.Map;

@Primary
@Component
public class RoutingSettingsStore implements SettingsStore {
    private final JsonSettingsStore jsonStore;
    private final PostgreSqlSettingsStore postgresStore;
    private final DataManagementService dataManagementService;

    public RoutingSettingsStore(
            JsonSettingsStore jsonStore,
            PostgreSqlSettingsStore postgresStore,
            @Lazy DataManagementService dataManagementService
    ) {
        this.jsonStore = jsonStore;
        this.postgresStore = postgresStore;
        this.dataManagementService = dataManagementService;
    }

    private SettingsStore activeStore() {
        if (dataManagementService.getMode() == DataSourceMode.POSTGRESQL) {
            return postgresStore;
        }
        return jsonStore;
    }

    @Override
    public Map<String, Object> readStored() {
        return activeStore().readStored();
    }

    @Override
    public void writeStored(Map<String, Object> settings) {
        activeStore().writeStored(settings);
    }
}
