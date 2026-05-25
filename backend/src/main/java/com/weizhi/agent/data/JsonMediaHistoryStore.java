package com.weizhi.agent.data;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.weizhi.agent.config.StorageProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

@Component
public class JsonMediaHistoryStore implements MediaHistoryStore {
    private static final Logger log = LoggerFactory.getLogger(JsonMediaHistoryStore.class);

    private final StorageProperties storageProperties;
    private final ObjectMapper objectMapper;

    public JsonMediaHistoryStore(StorageProperties storageProperties, ObjectMapper objectMapper) {
        this.storageProperties = storageProperties;
        this.objectMapper = objectMapper;
    }

    @Override
    public synchronized void appendImage(String prompt, String filename, String url, String model) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", UUID.randomUUID().toString());
        item.put("prompt", prompt);
        item.put("filename", filename);
        item.put("url", url);
        item.put("model", model);
        item.put("createdAt", Instant.now().toString());
        append(storageProperties.getImageHistoryFile(), item);
    }

    @Override
    public synchronized void appendTts(String text, String voiceId, String model, String format, String audioUrl, boolean preview, String source) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", UUID.randomUUID().toString());
        item.put("text", text);
        item.put("voiceId", voiceId);
        item.put("model", model);
        item.put("format", format);
        item.put("audioUrl", audioUrl);
        item.put("preview", preview);
        item.put("source", source);
        item.put("createdAt", Instant.now().toString());
        append(storageProperties.getTtsHistoryFile(), item);
    }

    @Override
    public synchronized List<Map<String, Object>> getImageHistory() {
        List<Map<String, Object>> histories = read(storageProperties.getImageHistoryFile());
        List<Map<String, Object>> merged = mergeImageFiles(histories);
        if (merged.size() != histories.size()) {
            write(storageProperties.getImageHistoryFile(), merged);
        }
        return merged;
    }

    @Override
    public synchronized List<Map<String, Object>> getTtsHistory() {
        return read(storageProperties.getTtsHistoryFile());
    }

    @Override
    public synchronized boolean deleteImageHistory(String id) {
        List<Map<String, Object>> all = read(storageProperties.getImageHistoryFile());
        int originalSize = all.size();
        all.removeIf(item -> {
            if (id.equals(String.valueOf(item.get("id")))) {
                Object filename = item.get("filename");
                if (filename != null) {
                    deletePhysicalFile(storageProperties.getImageDir(), String.valueOf(filename));
                    deletePhysicalFile("generated_images", String.valueOf(filename));
                }
                return true;
            }
            return false;
        });
        if (all.size() == originalSize) return false;
        write(storageProperties.getImageHistoryFile(), all);
        return true;
    }

    @Override
    public synchronized boolean deleteTtsHistory(String id) {
        List<Map<String, Object>> all = read(storageProperties.getTtsHistoryFile());
        int originalSize = all.size();
        all.removeIf(item -> {
            if (id.equals(String.valueOf(item.get("id")))) {
                Object audioUrl = item.get("audioUrl");
                if (audioUrl != null) {
                    String urlStr = String.valueOf(audioUrl);
                    String audioFilename = urlStr.contains("/") ? urlStr.substring(urlStr.lastIndexOf('/') + 1) : urlStr;
                    deletePhysicalFile(storageProperties.getAudioDir(), audioFilename);
                }
                return true;
            }
            return false;
        });
        if (all.size() == originalSize) return false;
        write(storageProperties.getTtsHistoryFile(), all);
        return true;
    }

    @Override
    public synchronized void clearImageHistory() {
        write(storageProperties.getImageHistoryFile(), new ArrayList<>());
    }

    @Override
    public synchronized void clearTtsHistory() {
        write(storageProperties.getTtsHistoryFile(), new ArrayList<>());
    }

    private void append(String filePath, Map<String, Object> item) {
        List<Map<String, Object>> all = read(filePath);
        all.add(0, item);
        if (all.size() > 200) {
            all = new ArrayList<>(all.subList(0, 200));
        }
        write(filePath, all);
    }

    private List<Map<String, Object>> read(String filePath) {
        try {
            Path path = Paths.get(filePath).toAbsolutePath().normalize();
            if (!Files.exists(path)) return new ArrayList<>();
            return objectMapper.readValue(path.toFile(), new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            log.warn("Failed to read history file {}: {}", filePath, e.getMessage());
            return new ArrayList<>();
        }
    }

    private void write(String filePath, List<Map<String, Object>> data) {
        try {
            Path path = Paths.get(filePath).toAbsolutePath().normalize();
            if (path.getParent() != null) Files.createDirectories(path.getParent());
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(path.toFile(), data);
        } catch (IOException e) {
            log.error("Failed to write history file {}: {}", filePath, e.getMessage(), e);
        }
    }

    private void deletePhysicalFile(String directory, String filename) {
        try {
            Path dir = Paths.get(directory).toAbsolutePath().normalize();
            Path file = dir.resolve(filename).normalize();
            if (!file.startsWith(dir)) {
                log.warn("Path traversal attempt blocked: {} not inside {}", file, dir);
                return;
            }
            if (Files.exists(file)) {
                Files.delete(file);
                log.info("Deleted physical file: {}", file);
            }
        } catch (IOException e) {
            log.warn("Failed to delete physical file {}/{}: {}", directory, filename, e.getMessage());
        }
    }

    private List<Map<String, Object>> mergeImageFiles(List<Map<String, Object>> histories) {
        List<Map<String, Object>> merged = new ArrayList<>(histories);
        Set<String> knownFilenames = new HashSet<>();
        for (Map<String, Object> item : histories) {
            Object filename = item.get("filename");
            if (filename != null) knownFilenames.add(String.valueOf(filename));
        }

        scanImageDir(Paths.get(storageProperties.getImageDir()).toAbsolutePath().normalize(), merged, knownFilenames);
        scanImageDir(Paths.get("generated_images").toAbsolutePath().normalize(), merged, knownFilenames);
        return merged;
    }

    private void scanImageDir(Path dir, List<Map<String, Object>> merged, Set<String> knownFilenames) {
        if (!Files.isDirectory(dir)) return;
        try (Stream<Path> files = Files.list(dir)) {
            files
                    .filter(Files::isRegularFile)
                    .filter(this::isImageFile)
                    .sorted((a, b) -> {
                        try {
                            return Files.getLastModifiedTime(b).compareTo(Files.getLastModifiedTime(a));
                        } catch (IOException e) {
                            return 0;
                        }
                    })
                    .forEach(path -> {
                        String filename = path.getFileName().toString();
                        if (knownFilenames.contains(filename)) return;
                        knownFilenames.add(filename);
                        Map<String, Object> item = new LinkedHashMap<>();
                        item.put("id", "legacy-" + filename);
                        item.put("prompt", "历史图片");
                        item.put("filename", filename);
                        item.put("url", "/api/images/files/" + filename);
                        item.put("model", "legacy");
                        try {
                            item.put("createdAt", Files.getLastModifiedTime(path).toInstant().toString());
                        } catch (IOException e) {
                            item.put("createdAt", Instant.now().toString());
                        }
                        merged.add(item);
                    });
        } catch (IOException e) {
            log.warn("Failed to scan image directory {}: {}", dir, e.getMessage());
        }
    }

    private boolean isImageFile(Path path) {
        String name = path.getFileName().toString().toLowerCase();
        return name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg")
                || name.endsWith(".webp") || name.endsWith(".gif");
    }
}
