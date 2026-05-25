package com.weizhi.agent.tools;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.weizhi.agent.config.StorageProperties;
import com.weizhi.agent.model.TtsRequest;
import com.weizhi.agent.service.AiSettingsService;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Service that encapsulates MiniMax TTS logic.
 * Converted from Spring AI @Configuration / @Bean Function to a regular @Service.
 */
@Service
public class TtsTools {
    private static final Logger log = LoggerFactory.getLogger(TtsTools.class);

    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final StorageProperties storageProperties;
    private final AiSettingsService settingsService;

    @Value("${minimax.tts-endpoint}")
    private String ttsEndpoint;

    public TtsTools(OkHttpClient okHttpClient, ObjectMapper objectMapper,
                    StorageProperties storageProperties, AiSettingsService settingsService) {
        this.httpClient = okHttpClient;
        this.objectMapper = objectMapper;
        this.storageProperties = storageProperties;
        this.settingsService = settingsService;
    }

    /**
     * Synthesizes speech from text using the MiniMax TTS API.
     *
     * @param request the TTS request parameters
     * @return a human-readable result string with the audio URL
     */
    public String ttsSynthesize(TtsRequest request) {
        try {
            String text = request.getText() == null ? "" : request.getText().trim();
            if (text.isEmpty()) return "文本为空，无法生成语音。";

            String voiceId = blankToDefault(request.getVoiceId(), "male-qn-qingse");
            String model = blankToDefault(request.getModel(), "speech-2.8-hd");
            String format = "mp3";
            double speed = request.getSpeed() == null ? 1.0 : request.getSpeed();
            double vol = request.getVol() == null ? 1.0 : request.getVol();
            int pitch = request.getPitch() == null ? 0 : request.getPitch();
            int sampleRate = request.getSampleRate() == null ? 32000 : request.getSampleRate();
            int bitrate = request.getBitrate() == null ? 128000 : request.getBitrate();

            Map<String, Object> bodyMap = Map.of(
                    "model", model,
                    "text", text,
                    "stream", false,
                    "language_boost", getLanguageBoost(voiceId, text),
                    "output_format", "hex",
                    "voice_setting", Map.of(
                            "voice_id", voiceId,
                            "speed", speed,
                            "vol", vol,
                            "pitch", pitch
                    ),
                    "audio_setting", Map.of(
                            "sample_rate", sampleRate,
                            "bitrate", bitrate,
                            "format", format,
                            "channel", 1
                    )
            );

            Request httpRequest = new Request.Builder()
                    .url(ttsEndpoint)
                    .addHeader("Authorization", "Bearer " + settingsService.apiKey("minimax"))
                    .post(RequestBody.create(objectMapper.writeValueAsString(bodyMap), MediaType.parse("application/json")))
                    .build();

            try (Response response = httpClient.newCall(httpRequest).execute()) {
                if (!response.isSuccessful()) return "语音生成失败: " + response.message();
                String raw = response.body().string();
                JsonNode root = objectMapper.readTree(raw);
                String hexAudio = root.at("/data/audio").asText();
                if (hexAudio == null || hexAudio.isEmpty()) return "API 未返回有效语音数据。";

                byte[] audioBytes = hexToBytes(hexAudio);
                String fileName = FileUtils.generateUniqueFilename(format);
                Path dir = Paths.get(storageProperties.getAudioDir()).toAbsolutePath();
                Files.createDirectories(dir);
                Files.write(dir.resolve(fileName), audioBytes);

                return "语音已生成: /api/tts/audio/" + fileName;
            }
        } catch (Exception e) {
            log.error("TTS tool error: {}", e.getMessage(), e);
            return "语音生成异常: " + e.getMessage();
        }
    }

    /**
     * Returns a list of available voices as a formatted string.
     */
    public String listVoices() {
        return defaultVoices().stream()
                .map(v -> String.format("%s (%s)", v.get("name"), v.get("voiceId")))
                .collect(Collectors.joining(", "));
    }

    public List<Map<String, String>> defaultVoices() {
        return List.of(
                Map.of("voiceId", "male-qn-qingse", "name", "男 - 清涩青年"),
                Map.of("voiceId", "male-qn-jingying", "name", "男 - 精英青年"),
                Map.of("voiceId", "female-shaonv", "name", "女 - 少女"),
                Map.of("voiceId", "female-yujie", "name", "女 - 御姐"),
                Map.of("voiceId", "female-tianmei", "name", "女 - 甜美女性"),
                Map.of("voiceId", "Cantonese_CuteGirl", "name", "女 - 粤语可爱女孩"),
                Map.of("voiceId", "male-qn-badao", "name", "男 - 霸道总裁"),
                Map.of("voiceId", "male-qn-daxuesheng", "name", "男 - 男大学生"),
                Map.of("voiceId", "audiobook_male_1", "name", "朗读 - 悬疑男声"),
                Map.of("voiceId", "audiobook_male_2", "name", "朗读 - 沉稳男声"),
                Map.of("voiceId", "audiobook_female_1", "name", "朗读 - 温柔女声"),
                Map.of("voiceId", "audiobook_female_2", "name", "朗读 - 动情女声")
        );
    }

    String getLanguageBoost(String voiceId, String text) {
        if (voiceId == null || voiceId.isBlank()) {
            return "Chinese";
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

    private static String blankToDefault(String value, String defaultValue) {
        if (value == null || value.isBlank()) return defaultValue;
        return value.trim();
    }
}
