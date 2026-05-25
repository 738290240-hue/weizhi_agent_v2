package com.weizhi.agent.controller;

import com.weizhi.agent.service.DataManagementService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(DataManagementController.class)
class DataManagementControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DataManagementService dataManagementService;

    @Test
    void status_returnsCurrentMode() throws Exception {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("mode", "json");
        status.put("ready", true);
        when(dataManagementService.status()).thenReturn(status);

        mockMvc.perform(get("/api/data-management/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mode").value("json"))
                .andExpect(jsonPath("$.ready").value(true));
    }

    @Test
    void mode_rejectsPostgresqlWhenUnavailable() throws Exception {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", false);
        result.put("mode", "json");
        result.put("message", "PostgreSQL mode is visible but not ready in this phase.");
        when(dataManagementService.switchMode(eq("postgresql"))).thenReturn(result);

        mockMvc.perform(post("/api/data-management/mode")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"postgresql\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.mode").value("json"));
    }
}
