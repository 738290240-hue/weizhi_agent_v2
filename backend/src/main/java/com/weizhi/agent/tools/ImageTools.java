package com.weizhi.agent.tools;

import com.weizhi.agent.config.StorageProperties;
import com.weizhi.agent.model.ImageGenerationRequest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.weizhi.agent.service.AiSettingsService;
import okhttp3.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Base64;
import java.util.Map;

/**
 * Service that encapsulates MiniMax image generation logic.
 * Converted from Spring AI @Configuration / @Bean Function to a regular @Service.
 */
@Service
public class ImageTools {
    private static final Logger log = LoggerFactory.getLogger(ImageTools.class);

    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final AiSettingsService settingsService;
    private final StorageProperties storageProperties;

    @Value("${minimax.image-generation-endpoint}")
    private String imageGenerationEndpoint;

    public ImageTools(OkHttpClient okHttpClient, ObjectMapper objectMapper,
                      AiSettingsService settingsService, StorageProperties storageProperties) {
        this.httpClient = okHttpClient;
        this.objectMapper = objectMapper;
        this.settingsService = settingsService;
        this.storageProperties = storageProperties;
    }

    /**
     * Generates an image using the MiniMax API and saves it to local disk.
     *
     * @param request the image generation request
     * @return a human-readable result string with the image URL
     */
    public String generateImage(ImageGenerationRequest request) {
        log.info("ImageTools: generating image with prompt: {}", request.getPrompt());
        try {
            Map<String, Object> bodyMap = Map.of(
                "model", "image-01",
                "prompt", request.getPrompt(),
                "response_format", "base64",
                "aspect_ratio", request.getAspectRatio() != null ? request.getAspectRatio() : "1:1",
                "n", 1
            );

            Request httpRequest = new Request.Builder()
                    .url(imageGenerationEndpoint)
                    .addHeader("Authorization", "Bearer " + settingsService.apiKey("minimax"))
                    .post(RequestBody.create(objectMapper.writeValueAsString(bodyMap), MediaType.parse("application/json")))
                    .build();

            try (Response response = httpClient.newCall(httpRequest).execute()) {
                if (!response.isSuccessful()) return "图片生成失败: " + response.message();
                String body = response.body().string();
                JsonNode root = objectMapper.readTree(body);
                String base64 = root.at("/data/image_base64/0").asText();

                if (base64 == null || base64.isEmpty()) return "API 未返回有效图片数据";

                byte[] data = Base64.getDecoder().decode(base64);
                String ext = FileUtils.detectImageExtension(data);
                String filename = FileUtils.generateUniqueFilename(ext);

                Path baseDir = Paths.get(storageProperties.getImageDir()).toAbsolutePath();
                Files.createDirectories(baseDir);
                Files.write(baseDir.resolve(filename), data);

                String imageUrl = "/api/images/files/" + filename;
                log.info("Image saved: {}", filename);
                return "图片已成功生成并保存。URL: " + imageUrl + "。请告诉用户可以通过预览区查看。";
            }
        } catch (Exception e) {
            log.error("Image generation error: {}", e.getMessage(), e);
            return "执行出错: " + e.getMessage();
        }
    }
}
