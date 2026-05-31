package com.weizhi.agent.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.weizhi.agent.config.StorageProperties;
import com.weizhi.agent.model.DocumentChunk;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

public class RagRetrieverTest {

    private StorageProperties storageProperties;
    private ObjectMapper objectMapper;
    private DocumentService documentService;
    private RagRetriever ragRetriever;

    @TempDir
    Path tempDir;

    @BeforeEach
    public void setUp() {
        storageProperties = new StorageProperties();
        storageProperties.setDocumentDir(tempDir.resolve("documents").toString());
        storageProperties.setDocumentIndexFile(tempDir.resolve("document-index.json").toString());
        objectMapper = new ObjectMapper();
        documentService = new DocumentService(storageProperties, objectMapper);
        ragRetriever = new RagRetriever(documentService);
    }

    @Test
    public void testRetrieveChunks() throws IOException {
        String doc1Content = "Apple is a tech company. They design iPhones, iPads, and Macs. Located in Cupertino, California.";
        String doc2Content = "SpaceX is an aerospace company. They build rockets like Falcon 9 and Starship. Founded by Elon Musk.";

        documentService.uploadDocument("Apple info", new MockMultipartFile("file", "apple.txt", "text/plain", doc1Content.getBytes(StandardCharsets.UTF_8)));
        documentService.uploadDocument("SpaceX info", new MockMultipartFile("file", "spacex.txt", "text/plain", doc2Content.getBytes(StandardCharsets.UTF_8)));

        // Retrieve "iPhone Cupertino" -> Should match Apple chunk
        List<DocumentChunk> resultsApple = ragRetriever.retrieve("Who designs iPhones in Cupertino?", null, 1);
        assertEquals(1, resultsApple.size());
        assertTrue(resultsApple.get(0).getContent().contains("Cupertino"));

        // Retrieve "Falcon Rocket" -> Should match SpaceX chunk
        List<DocumentChunk> resultsSpaceX = ragRetriever.retrieve("Tell me about Falcon rocket launch", null, 1);
        assertEquals(1, resultsSpaceX.size());
        assertTrue(resultsSpaceX.get(0).getContent().contains("SpaceX"));
    }
}
