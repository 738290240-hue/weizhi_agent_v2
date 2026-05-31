package com.weizhi.agent.controller;

import com.weizhi.agent.service.GeminiCapabilitiesResult;
import com.weizhi.agent.service.GeminiModelProbeService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/gemini/models")
public class GeminiModelController {
    private final GeminiModelProbeService probeService;

    public GeminiModelController(GeminiModelProbeService probeService) {
        this.probeService = probeService;
    }

    @GetMapping("/capabilities")
    public GeminiCapabilitiesResult capabilities() {
        return probeService.getCapabilities();
    }

    @PostMapping("/probe")
    public GeminiCapabilitiesResult probe() {
        return probeService.probe();
    }
}
