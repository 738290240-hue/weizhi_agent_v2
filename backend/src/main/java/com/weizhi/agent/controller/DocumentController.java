package com.weizhi.agent.controller;

import com.weizhi.agent.config.StorageProperties;
import com.weizhi.agent.model.DocumentRecord;
import com.weizhi.agent.service.DocumentService;
import com.weizhi.agent.tools.FileUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {
    private static final Logger log = LoggerFactory.getLogger(DocumentController.class);

    private final DocumentService documentService;
    private final StorageProperties storageProperties;

    public DocumentController(DocumentService documentService, StorageProperties storageProperties) {
        this.documentService = documentService;
        this.storageProperties = storageProperties;
    }

    @PostMapping("/upload")
    public ResponseEntity<?> uploadDocument(
            @RequestParam(value = "name", required = false) String name,
            @RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "文件不能为空"));
        }

        String originalFilename = file.getOriginalFilename();
        log.info("RAG upload request for original filename: {}", originalFilename);

        try {
            DocumentRecord record = documentService.uploadDocument(name, file);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "document", record
            ));
        } catch (Exception e) {
            log.error("Failed to parse and upload RAG document: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "解析文档失败: " + e.getMessage()
            ));
        }
    }

    @GetMapping
    public List<DocumentRecord> getDocuments() {
        return documentService.getDocuments();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteDocument(@PathVariable("id") String id) {
        boolean success = documentService.deleteDocument(id);
        if (success) {
            return ResponseEntity.ok(Map.of("success", true));
        } else {
            return ResponseEntity.status(404).body(Map.of("success", false, "message", "未找到指定文档"));
        }
    }

    @GetMapping("/download/{filename:.+}")
    public ResponseEntity<Resource> downloadFile(@PathVariable String filename) {
        try {
            Path fileDir = Paths.get(storageProperties.getDocumentDir()).toAbsolutePath().normalize();
            Path filePath = fileDir.resolve(filename).normalize();

            // Safety path traversal check
            if (!FileUtils.isPathSafe(filePath.toString(), fileDir.toString())) {
                log.warn("Path traversal attempt blocked: download of {}", filename);
                return ResponseEntity.status(403).build();
            }

            Resource resource = new UrlResource(filePath.toUri());
            if (resource.exists() || resource.isReadable()) {
                String ext = FileUtils.getFileExtension(filename).toLowerCase();
                String contentType = "application/octet-stream";
                if ("txt".equals(ext)) contentType = "text/plain";
                else if ("md".equals(ext)) contentType = "text/markdown";
                else if ("pdf".equals(ext)) contentType = "application/pdf";

                return ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(contentType))
                        .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + resource.getFilename() + "\"")
                        .body(resource);
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            log.error("Failed to download RAG document file {}: {}", filename, e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
}
