package com.weizhi.agent.controller;

import com.weizhi.agent.service.DataManagementService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/data-management")
public class DataManagementController {
    private final DataManagementService dataManagementService;

    public DataManagementController(DataManagementService dataManagementService) {
        this.dataManagementService = dataManagementService;
    }

    @GetMapping("/status")
    public Map<String, Object> status() {
        return dataManagementService.status();
    }

    @PostMapping("/mode")
    public Map<String, Object> mode(@RequestBody Map<String, Object> body) {
        return dataManagementService.switchMode(String.valueOf(body.getOrDefault("mode", "json")));
    }

    @PostMapping("/test-connection")
    public Map<String, Object> testConnection(@RequestBody(required = false) Map<String, Object> body) {
        String mode = body == null ? "json" : String.valueOf(body.getOrDefault("mode", "json"));
        return dataManagementService.testConnection(mode);
    }
}
