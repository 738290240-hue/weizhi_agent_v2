package com.weizhi.agent.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.weizhi.agent.config.StorageProperties;
import com.weizhi.agent.model.DocumentChunk;
import com.weizhi.agent.model.DocumentRecord;
import com.weizhi.agent.tools.FileUtils;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

@Service
public class DocumentService {
    private static final Logger log = LoggerFactory.getLogger(DocumentService.class);

    private final StorageProperties storageProperties;
    private final ObjectMapper objectMapper;
    private final List<DocumentRecord> documentCache = new ArrayList<>();

    public DocumentService(StorageProperties storageProperties, ObjectMapper objectMapper) {
        this.storageProperties = storageProperties;
        this.objectMapper = objectMapper;
        loadDocumentIndex();
    }

    private synchronized void loadDocumentIndex() {
        try {
            Path path = Paths.get(storageProperties.getDocumentIndexFile()).toAbsolutePath().normalize();
            if (Files.exists(path)) {
                List<DocumentRecord> records = objectMapper.readValue(path.toFile(), new TypeReference<List<DocumentRecord>>() {});
                documentCache.clear();
                if (records != null) {
                    documentCache.addAll(records);
                }
                log.info("Loaded {} documents from local RAG index.", documentCache.size());
            } else {
                log.info("No document index file found. Starting with empty RAG library.");
            }
        } catch (Exception e) {
            log.error("Failed to load document index: {}", e.getMessage(), e);
        }
    }

    private synchronized void saveDocumentIndex() {
        try {
            Path path = Paths.get(storageProperties.getDocumentIndexFile()).toAbsolutePath().normalize();
            Files.createDirectories(path.getParent());
            objectMapper.writeValue(path.toFile(), documentCache);
            log.info("Saved local RAG index with {} documents.", documentCache.size());
        } catch (Exception e) {
            log.error("Failed to save document index: {}", e.getMessage(), e);
        }
    }

    public synchronized DocumentRecord uploadDocument(String name, MultipartFile file) throws IOException {
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null) {
            originalFilename = "unnamed.txt";
        }
        String ext = FileUtils.getFileExtension(originalFilename).toLowerCase();
        if (ext.isEmpty()) {
            ext = "txt";
        }

        byte[] bytes = file.getBytes();
        String uniqueName = FileUtils.generateUniqueFilename(ext);
        Path storageDir = Paths.get(storageProperties.getDocumentDir()).toAbsolutePath().normalize();
        Files.createDirectories(storageDir);
        Path destination = storageDir.resolve(uniqueName);
        Files.write(destination, bytes);

        log.info("Saved document file to {}", destination);

        // Extract Text Content
        String textContent = "";
        if ("pdf".equals(ext)) {
            textContent = extractTextFromPdf(destination.toFile());
        } else {
            // Treat as plain text
            textContent = new String(bytes, StandardCharsets.UTF_8);
        }

        // Generate Chunks (800 chars chunk size, 150 chars overlap)
        String docId = UUID.randomUUID().toString();
        List<DocumentChunk> chunks = createChunks(docId, textContent, 800, 150);

        DocumentRecord record = new DocumentRecord(
                docId,
                name == null || name.isBlank() ? originalFilename : name,
                uniqueName,
                ext,
                file.getSize(),
                System.currentTimeMillis(),
                "/api/documents/download/" + uniqueName,
                chunks
        );

        documentCache.add(record);
        saveDocumentIndex();
        return record;
    }

    public synchronized List<DocumentRecord> getDocuments() {
        return new ArrayList<>(documentCache);
    }

    public synchronized DocumentRecord getDocument(String id) {
        return documentCache.stream()
                .filter(d -> d.getId().equals(id))
                .findFirst()
                .orElse(null);
    }

    public synchronized boolean deleteDocument(String id) {
        Optional<DocumentRecord> recordOpt = documentCache.stream()
                .filter(d -> d.getId().equals(id))
                .findFirst();

        if (recordOpt.isPresent()) {
            DocumentRecord record = recordOpt.get();
            documentCache.remove(record);
            saveDocumentIndex();

            // Try to delete physical file
            try {
                Path destination = Paths.get(storageProperties.getDocumentDir())
                        .resolve(record.getFilename())
                        .toAbsolutePath()
                        .normalize();
                Files.deleteIfExists(destination);
                log.info("Deleted physical document file: {}", destination);
            } catch (Exception e) {
                log.warn("Failed to delete physical document file {}: {}", record.getFilename(), e.getMessage());
            }
            return true;
        }
        return false;
    }

    public synchronized List<DocumentChunk> getAllChunks(List<String> allowedDocIds) {
        List<DocumentChunk> all = new ArrayList<>();
        for (DocumentRecord record : documentCache) {
            if (allowedDocIds == null || allowedDocIds.isEmpty() || allowedDocIds.contains(record.getId())) {
                if (record.getChunks() != null) {
                    all.addAll(record.getChunks());
                }
            }
        }
        return all;
    }

    private String extractTextFromPdf(File pdfFile) throws IOException {
        try (PDDocument document = Loader.loadPDF(pdfFile)) {
            PDFTextStripper stripper = new PDFTextStripper();
            return stripper.getText(document);
        } catch (Exception e) {
            log.error("PDF text extraction failed for file {}: {}", pdfFile.getName(), e.getMessage(), e);
            throw new IOException("解析 PDF 失败: " + e.getMessage(), e);
        }
    }

    private List<DocumentChunk> createChunks(String docId, String text, int chunkSize, int overlap) {
        List<DocumentChunk> chunks = new ArrayList<>();
        if (text == null || text.isBlank()) return chunks;

        int index = 0;
        int start = 0;
        while (start < text.length()) {
            int end = Math.min(start + chunkSize, text.length());
            String chunkText = text.substring(start, end);
            chunks.add(new DocumentChunk(docId + "_" + index, docId, index, chunkText));
            index++;
            if (end == text.length()) break;
            start += (chunkSize - overlap);
        }
        log.info("Split document {} into {} text chunks.", docId, chunks.size());
        return chunks;
    }
}
