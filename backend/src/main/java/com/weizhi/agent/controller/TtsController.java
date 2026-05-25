package com.weizhi.agent.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.weizhi.agent.config.StorageProperties;
import com.weizhi.agent.model.TtsRequest;
import com.weizhi.agent.service.AiSettingsService;
import com.weizhi.agent.service.HistoryService;
import com.weizhi.agent.tools.FileUtils;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tts")
public class TtsController {
    private static final Logger log = LoggerFactory.getLogger(TtsController.class);

    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final StorageProperties storageProperties;
    private final HistoryService historyService;
    private final AiSettingsService settingsService;

    @Value("${minimax.tts-endpoint}")
    private String ttsEndpoint;

    public TtsController(OkHttpClient okHttpClient, ObjectMapper objectMapper,
                         StorageProperties storageProperties, HistoryService historyService,
                         AiSettingsService settingsService) {
        this.httpClient = okHttpClient;
        this.objectMapper = objectMapper;
        this.storageProperties = storageProperties;
        this.historyService = historyService;
        this.settingsService = settingsService;
    }

    @PostMapping("/tts")
    public ResponseEntity<?> tts(@org.springframework.web.bind.annotation.RequestBody TtsRequest request) {
        return synthesize(request, false);
    }

    @PostMapping("/preview")
    public ResponseEntity<?> preview(@org.springframework.web.bind.annotation.RequestBody TtsRequest request) {
        String text = request.getText() == null ? "" : request.getText().trim();
        if (text.length() > 120) {
            text = text.substring(0, 120);
            request.setText(text);
        }
        return synthesize(request, true);
    }

    @GetMapping("/history")
    public ResponseEntity<?> history() {
        return ResponseEntity.ok()
                .header("Cache-Control", "no-cache, no-store, must-revalidate")
                .body(Map.of("histories", historyService.getTtsHistory()));
    }

    @DeleteMapping("/history/{id}")
    public ResponseEntity<?> deleteHistory(@PathVariable String id) {
        boolean deleted = historyService.deleteTtsHistory(id);
        return ResponseEntity.ok(Map.of("success", deleted));
    }

    @DeleteMapping("/history")
    public ResponseEntity<?> clearHistory() {
        historyService.clearTtsHistory();
        return ResponseEntity.ok(Map.of("success", true));
    }

    private ResponseEntity<?> synthesize(TtsRequest request, boolean previewMode) {
        try {
            String text = request.getText() == null ? "" : request.getText().trim();
            if (text.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "text 不能为空"));
            }

            String voiceId = request.getVoiceId() == null || request.getVoiceId().isBlank() ? "male-qn-qingse" : request.getVoiceId().trim();
            String model = request.getModel() == null || request.getModel().isBlank() ? "speech-2.8-hd" : request.getModel().trim();
            String format = "mp3";
            double speed = request.getSpeed() == null ? 1.0 : request.getSpeed();
            double vol = request.getVol() == null ? 1.0 : request.getVol();
            int pitch = request.getPitch() == null ? 0 : request.getPitch();
            int sampleRate = request.getSampleRate() == null ? 32000 : request.getSampleRate();
            int bitrate = request.getBitrate() == null ? 128000 : request.getBitrate();

            String languageBoost = request.getLanguageBoost();
            if (languageBoost == null || languageBoost.isBlank()) {
                languageBoost = getLanguageBoost(voiceId, text);
            }

            Map<String, Object> bodyMap = Map.of(
                    "model", model,
                    "text", text,
                    "stream", false,
                    "language_boost", languageBoost,
                    "output_format", "hex",
                    "voice_setting", Map.of("voice_id", voiceId, "speed", speed, "vol", vol, "pitch", pitch),
                    "audio_setting", Map.of("sample_rate", sampleRate, "bitrate", bitrate, "format", format, "channel", 1)
            );

            Request httpRequest = new Request.Builder()
                    .url(ttsEndpoint)
                    .addHeader("Authorization", "Bearer " + settingsService.apiKey("minimax"))
                    .post(RequestBody.create(objectMapper.writeValueAsString(bodyMap), MediaType.parse("application/json")))
                    .build();

            try (Response response = httpClient.newCall(httpRequest).execute()) {
                if (!response.isSuccessful()) {
                    return ResponseEntity.badRequest().body(Map.of("success", false, "message", response.message()));
                }
                String raw = response.body().string();
                JsonNode root = objectMapper.readTree(raw);
                String hexAudio = root.at("/data/audio").asText();
                if (hexAudio == null || hexAudio.isEmpty()) {
                    return ResponseEntity.badRequest().body(Map.of("success", false, "message", "API 未返回语音数据"));
                }

                byte[] audioBytes = hexToBytes(hexAudio);
                String fileName = FileUtils.generateUniqueFilename(format);
                Path baseDir = Paths.get(storageProperties.getAudioDir()).toAbsolutePath();
                Files.createDirectories(baseDir);
                Files.write(baseDir.resolve(fileName), audioBytes);
                String audioUrl = "/api/tts/audio/" + fileName;
                historyService.appendTts(text, voiceId, model, format, audioUrl, previewMode, request.getSource());

                Map<String, Object> details = new LinkedHashMap<>();
                details.put("success", true);
                details.put("audioUrl", audioUrl);
                details.put("filename", fileName);
                details.put("voiceId", voiceId);
                details.put("model", model);
                details.put("format", format);
                details.put("speed", speed);
                details.put("vol", vol);
                details.put("pitch", pitch);
                details.put("sampleRate", sampleRate);
                details.put("bitrate", bitrate);
                details.put("preview", previewMode);
                details.put("source", request.getSource());
                return ResponseEntity.ok(details);
            }
        } catch (Exception e) {
            log.error("TTS synthesis failed: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    private List<Map<String, Object>> voicesList = null;

    private synchronized void loadVoicesFromResource() {
        if (voicesList != null) {
            return;
        }
        try {
            java.io.InputStream resourceStream = getClass().getResourceAsStream("/voices.json");
            if (resourceStream != null) {
                voicesList = objectMapper.readValue(resourceStream, new TypeReference<List<Map<String, Object>>>() {});
                log.info("Successfully loaded {} voices from voices.json", voicesList.size());
            } else {
                log.warn("voices.json not found in resources path, using fallback basic list");
            }
        } catch (Exception e) {
            log.error("Failed to load voices from voices.json: {}", e.getMessage(), e);
        }
        if (voicesList == null) {
            voicesList = List.of(
                Map.of("voiceId", "male-qn-qingse", "name", "男 - 清涩青年", "description", "系统经典中文音色", "category", "中文"),
                Map.of("voiceId", "male-qn-jingying", "name", "男 - 精英青年", "description", "系统经典中文音色", "category", "中文"),
                Map.of("voiceId", "female-shaonv", "name", "女 - 少女", "description", "系统经典中文音色", "category", "中文"),
                Map.of("voiceId", "female-yujie", "name", "女 - 御姐", "description", "系统经典中文音色", "category", "中文"),
                Map.of("voiceId", "female-tianmei", "name", "女 - 甜美女性", "description", "系统经典中文音色", "category", "中文")
            );
        }
    }

    @GetMapping("/voices")
    public ResponseEntity<?> voices() {
        loadVoicesFromResource();
        return ResponseEntity.ok(Map.of("voices", voicesList));
    }

    @GetMapping("/audio/{filename}")
    public ResponseEntity<Resource> getAudio(@PathVariable String filename) {
        try {
            Path basePath = Paths.get(storageProperties.getAudioDir()).toAbsolutePath().normalize();
            Path filePath = basePath.resolve(filename).normalize();
            if (!FileUtils.isPathSafe(filePath.toString(), basePath.toString()) || !Files.exists(filePath)) {
                return ResponseEntity.notFound().build();
            }
            Resource resource = new UrlResource(filePath.toUri());
            return ResponseEntity.ok().body(resource);
        } catch (Exception e) {
            log.error("Failed to serve audio {}: {}", filename, e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    String getLanguageBoost(String voiceId, String text) {
        if (voiceId == null || voiceId.isBlank()) {
            return "Chinese";
        }
        
        loadVoicesFromResource();
        if (voicesList != null) {
            for (Map<String, Object> voice : voicesList) {
                if (voiceId.equals(voice.get("voiceId"))) {
                    String category = (String) voice.get("category");
                    if ("日文".equals(category)) {
                        return "Japanese";
                    } else if ("英文".equals(category)) {
                        return "English";
                    } else if ("中文".equals(category)) {
                        return "Chinese";
                    }
                    break;
                }
            }
        }

        String lowerId = voiceId.toLowerCase();
        if (lowerId.startsWith("japanese")) {
            return "Japanese";
        } else if (lowerId.startsWith("english")) {
            return "English";
        } else if (lowerId.startsWith("korean")) {
            return "Korean";
        } else if (lowerId.startsWith("dutch")) {
            return "Dutch";
        } else if (lowerId.startsWith("vietnamese")) {
            return "Vietnamese";
        } else if (lowerId.startsWith("cantonese")) {
            return "Chinese";
        }

        if (lowerId.contains("santa") || lowerId.contains("grinch") || lowerId.contains("rudolph") || 
            lowerId.contains("arnold") || lowerId.contains("girl") || lowerId.contains("lady") || 
            lowerId.contains("elf") || lowerId.contains("woman")) {
            return "English";
        }

        if (containsJapaneseKana(text)) {
            return "Japanese";
        }

        return "Chinese";
    }

    private static boolean containsJapaneseKana(String text) {
        if (text == null) return false;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if ((c >= '\u3040' && c <= '\u309F') || (c >= '\u30A0' && c <= '\u30FF')) {
                return true;
            }
        }
        return false;
    }

    private static byte[] hexToBytes(String hex) {
        int len = hex.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4)
                    + Character.digit(hex.charAt(i + 1), 16));
        }
        return data;
    }
}
