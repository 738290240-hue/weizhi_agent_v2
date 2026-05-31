package com.weizhi.agent.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DocumentRecord {
    private String id;
    private String name;
    private String filename;
    private String type; // e.g. "txt", "md", "pdf"
    private long sizeBytes;
    private long uploadTime;
    private String url;
    private List<DocumentChunk> chunks;
}
