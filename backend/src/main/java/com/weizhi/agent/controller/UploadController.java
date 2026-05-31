package com.weizhi.agent.controller;

import com.weizhi.agent.tools.FileUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;

@RestController
@RequestMapping("/api/upload")
public class UploadController {
    private static final Logger log = LoggerFactory.getLogger(UploadController.class);

    private final String imageDir;
    private final String audioDir;
    private final com.weizhi.agent.service.DocumentService documentService;

    public UploadController(
            @Value("${storage.image-dir:generated_images}") String imageDir,
            @Value("${storage.audio-dir:generated_audio}") String audioDir,
            com.weizhi.agent.service.DocumentService documentService
    ) {
        this.imageDir = imageDir;
        this.audioDir = audioDir;
        this.documentService = documentService;
    }

    @PostMapping
    public ResponseEntity<?> upload(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "上传文件不能为空"));
        }

        String originalFilename = file.getOriginalFilename();
        String contentType = file.getContentType();
        log.info("Received upload file: {}, size: {}, contentType: {}", originalFilename, file.getSize(), contentType);

        boolean isImage = (contentType != null && contentType.startsWith("image/")) || FileUtils.isValidImageExtension(originalFilename);
        boolean isAudio = (contentType != null && contentType.startsWith("audio/")) || isAudioExtension(originalFilename);
        boolean isDocument = isDocumentExtension(originalFilename);

        try {
            byte[] bytes = file.getBytes();
            String ext = FileUtils.getFileExtension(originalFilename);
            if (ext.isEmpty()) {
                ext = isImage ? "png" : (isAudio ? "mp3" : (isDocument ? "txt" : "bin"));
            }
            String uniqueName = FileUtils.generateUniqueFilename(ext);

            if (isImage) {
                Path dir = Paths.get(imageDir).toAbsolutePath();
                Files.createDirectories(dir);
                Files.write(dir.resolve(uniqueName), bytes);
                String url = "/api/images/files/" + uniqueName;
                return ResponseEntity.ok(Map.of(
                        "success", true,
                        "url", url,
                        "type", "image",
                        "name", originalFilename
                ));
            } else if (isAudio) {
                Path dir = Paths.get(audioDir).toAbsolutePath();
                Files.createDirectories(dir);
                Files.write(dir.resolve(uniqueName), bytes);
                String url = "/api/tts/audio/" + uniqueName;
                return ResponseEntity.ok(Map.of(
                        "success", true,
                        "url", url,
                        "type", "audio",
                        "name", originalFilename
                ));
            } else if (isDocument) {
                com.weizhi.agent.model.DocumentRecord record = documentService.uploadDocument(null, file);
                return ResponseEntity.ok(Map.of(
                        "success", true,
                        "url", record.getUrl(),
                        "type", "document",
                        "name", originalFilename,
                        "id", record.getId()
                ));
            } else {
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "message", "暂不支持该类型文件的多模态上传，仅支持图片、音频与文档(PDF, TXT, MD)"
                ));
            }
        } catch (IOException e) {
            log.error("Failed to save uploaded file: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "保存文件失败: " + e.getMessage()
            ));
        }
    }

    @org.springframework.web.bind.annotation.ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    public ResponseEntity<?> handleMaxSizeException(org.springframework.web.multipart.MaxUploadSizeExceededException exc) {
        log.warn("Upload size exceeded: {}", exc.getMessage());
        return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", "上传文件超出大小限制，最大允许为 50MB"
        ));
    }

    private boolean isAudioExtension(String filename) {
        if (filename == null) return false;
        String ext = FileUtils.getFileExtension(filename);
        return ext.equals("mp3") || ext.equals("wav") || ext.equals("ogg") || ext.equals("m4a") || ext.equals("aac") || ext.equals("flac");
    }

    private boolean isDocumentExtension(String filename) {
        if (filename == null) return false;
        String ext = FileUtils.getFileExtension(filename).toLowerCase();
        return ext.equals("pdf") || ext.equals("txt") || ext.equals("md");
    }
}
