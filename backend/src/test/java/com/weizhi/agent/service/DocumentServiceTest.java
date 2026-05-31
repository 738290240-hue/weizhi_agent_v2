package com.weizhi.agent.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.weizhi.agent.config.StorageProperties;
import com.weizhi.agent.model.DocumentChunk;
import com.weizhi.agent.model.DocumentRecord;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

public class DocumentServiceTest {

    private StorageProperties storageProperties;
    private ObjectMapper objectMapper;
    private DocumentService documentService;

    @TempDir
    Path tempDir;

    @BeforeEach
    public void setUp() {
        storageProperties = new StorageProperties();
        storageProperties.setDocumentDir(tempDir.resolve("documents").toString());
        storageProperties.setDocumentIndexFile(tempDir.resolve("document-index.json").toString());
        objectMapper = new ObjectMapper();
        documentService = new DocumentService(storageProperties, objectMapper);
    }

    @Test
    public void testUploadAndGetTextDocument() throws IOException {
        String content = "Hello World. This is Weizhi Agent local document testing. It should be parsed correctly.";
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "test.txt",
                "text/plain",
                content.getBytes(StandardCharsets.UTF_8)
        );

        DocumentRecord record = documentService.uploadDocument("测试文本", file);
        assertNotNull(record);
        assertEquals("测试文本", record.getName());
        assertEquals("txt", record.getType());
        assertTrue(record.getChunks().size() > 0);

        List<DocumentRecord> docs = documentService.getDocuments();
        assertEquals(1, docs.size());
        assertEquals(record.getId(), docs.get(0).getId());

        List<DocumentChunk> chunks = documentService.getAllChunks(null);
        assertTrue(chunks.size() > 0);
        assertEquals(content, chunks.get(0).getContent());
    }
}
