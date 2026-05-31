package com.weizhi.agent.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DocumentChunk {
    private String id; // format: "docId_chunkIndex"
    private String documentId;
    private int chunkIndex;
    private String content;
}
