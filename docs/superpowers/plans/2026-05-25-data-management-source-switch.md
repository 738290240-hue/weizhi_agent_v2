# Data Management Source Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Data Management feature that keeps JSON files as the active local data source now, exposes PostgreSQL as a future source, and prepares backend store boundaries for later database implementation.

**Architecture:** Add backend store interfaces for settings and media history, with JSON-backed implementations preserving current behavior. Add a data management service/controller that reports JSON file status and rejects PostgreSQL mode until a database store exists. Add frontend API bindings, sidebar navigation, i18n labels, and a Data Management page with a real JSON/PostgreSQL source switch.

**Tech Stack:** Java 21, Spring Boot 3.3.4, Jackson, Vue 3, TypeScript, Vite, Vitest. No JDBC/JPA/MyBatis/PostgreSQL dependencies in this phase.

**Git Rule:** Do not commit implementation changes after coding. The user must manually test the feature first and explicitly approve the commit.

---

## File Structure

Create backend data source/store files:

- `backend/src/main/java/com/weizhi/agent/data/DataSourceMode.java`: enum for `json` and `postgresql`.
- `backend/src/main/java/com/weizhi/agent/data/SettingsStore.java`: interface for provider settings persistence.
- `backend/src/main/java/com/weizhi/agent/data/JsonSettingsStore.java`: JSON-backed settings implementation.
- `backend/src/main/java/com/weizhi/agent/data/MediaHistoryStore.java`: interface for image/TTS history persistence.
- `backend/src/main/java/com/weizhi/agent/data/JsonMediaHistoryStore.java`: JSON-backed media history implementation.
- `backend/src/main/java/com/weizhi/agent/service/DataManagementService.java`: reports current mode, JSON status, and PostgreSQL readiness.
- `backend/src/main/java/com/weizhi/agent/controller/DataManagementController.java`: exposes `/api/data-management/*`.

Modify backend service/config files:

- `backend/src/main/java/com/weizhi/agent/service/AiSettingsService.java`: depend on `SettingsStore` instead of direct file read/write.
- `backend/src/main/java/com/weizhi/agent/service/HistoryService.java`: depend on `MediaHistoryStore` instead of direct JSON read/write.
- `backend/src/main/resources/application.yml`: add `data-management.mode: json`.

Create or modify backend tests:

- `backend/src/test/java/com/weizhi/agent/data/JsonSettingsStoreTest.java`
- `backend/src/test/java/com/weizhi/agent/data/JsonMediaHistoryStoreTest.java`
- `backend/src/test/java/com/weizhi/agent/controller/DataManagementControllerTest.java`
- Update existing tests only if constructor signatures change.

Modify frontend files:

- `frontend/src/utils/api.ts`: add `dataManagementApi`.
- `frontend/src/components/layout/FloatingSidebar.vue`: add Data Management nav entry.
- `frontend/src/App.vue`: add `dataManagement` view, state, methods, and page markup.
- `frontend/src/locales/zh-CN.json`, `frontend/src/locales/zh-TW.json`, `frontend/src/locales/en-US.json`: add nav/page labels.

Optional generated JS siblings exist in this repo. If TypeScript/Vue changes require synchronized `.js` siblings for the current project convention, update matching `.js` files or regenerate them consistently. Do not hand-edit build output folders ignored by Git.

---

### Task 1: Add SettingsStore and JSON Settings Store

**Files:**
- Create: `backend/src/main/java/com/weizhi/agent/data/SettingsStore.java`
- Create: `backend/src/main/java/com/weizhi/agent/data/JsonSettingsStore.java`
- Test: `backend/src/test/java/com/weizhi/agent/data/JsonSettingsStoreTest.java`

- [ ] **Step 1: Write failing tests for JSON settings persistence**

Create `backend/src/test/java/com/weizhi/agent/data/JsonSettingsStoreTest.java`:

```java
package com.weizhi.agent.data;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class JsonSettingsStoreTest {
    @TempDir
    Path tempDir;

    @Test
    void readStored_returnsEmptyMapWhenFileDoesNotExist() {
        JsonSettingsStore store = new JsonSettingsStore(new ObjectMapper());
        store.setSettingsFile(tempDir.resolve("missing-settings.json").toString());

        Map<String, Object> result = store.readStored();

        assertTrue(result.isEmpty());
    }

    @Test
    void writeStored_createsParentDirectoriesAndPersistsSettings() throws Exception {
        Path settingsFile = tempDir.resolve("nested").resolve("ai-settings.json");
        JsonSettingsStore store = new JsonSettingsStore(new ObjectMapper());
        store.setSettingsFile(settingsFile.toString());

        Map<String, Object> provider = new LinkedHashMap<>();
        provider.put("apiKey", "test-key");
        provider.put("model", "test-model");
        Map<String, Object> settings = new LinkedHashMap<>();
        settings.put("minimax", provider);

        store.writeStored(settings);

        assertTrue(Files.exists(settingsFile));
        Map<String, Object> reread = store.readStored();
        assertEquals("test-model", ((Map<?, ?>) reread.get("minimax")).get("model"));
    }
}
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
cd backend
./mvnw -Dtest=JsonSettingsStoreTest test
```

Expected: compilation fails because `JsonSettingsStore` does not exist.

- [ ] **Step 3: Add `SettingsStore` interface**

Create `backend/src/main/java/com/weizhi/agent/data/SettingsStore.java`:

```java
package com.weizhi.agent.data;

import java.util.Map;

public interface SettingsStore {
    Map<String, Object> readStored();
    void writeStored(Map<String, Object> settings);
}
```

- [ ] **Step 4: Add JSON settings implementation**

Create `backend/src/main/java/com/weizhi/agent/data/JsonSettingsStore.java`:

```java
package com.weizhi.agent.data;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class JsonSettingsStore implements SettingsStore {
    private static final Logger log = LoggerFactory.getLogger(JsonSettingsStore.class);

    private final ObjectMapper objectMapper;

    @Value("${settings.file:data/ai-settings.json}")
    private String settingsFile;

    public JsonSettingsStore(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    void setSettingsFile(String settingsFile) {
        this.settingsFile = settingsFile;
    }

    public String getSettingsFile() {
        return settingsFile;
    }

    @Override
    public Map<String, Object> readStored() {
        try {
            Path path = Paths.get(settingsFile).toAbsolutePath().normalize();
            if (!Files.exists(path)) return new LinkedHashMap<>();
            return objectMapper.readValue(path.toFile(), new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.warn("Failed to read settings file {}: {}", settingsFile, e.getMessage());
            return new LinkedHashMap<>();
        }
    }

    @Override
    public void writeStored(Map<String, Object> settings) {
        try {
            Path path = Paths.get(settingsFile).toAbsolutePath().normalize();
            if (path.getParent() != null) Files.createDirectories(path.getParent());
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(path.toFile(), settings);
        } catch (Exception e) {
            log.error("Failed to write settings file {}: {}", settingsFile, e.getMessage(), e);
        }
    }
}
```

- [ ] **Step 5: Run the test**

Run:

```bash
cd backend
./mvnw -Dtest=JsonSettingsStoreTest test
```

Expected: `BUILD SUCCESS`.

---

### Task 2: Refactor AiSettingsService to Use SettingsStore

**Files:**
- Modify: `backend/src/main/java/com/weizhi/agent/service/AiSettingsService.java`
- Test: `backend/src/test/java/com/weizhi/agent/data/JsonSettingsStoreTest.java`

- [ ] **Step 1: Replace direct JSON dependencies with SettingsStore**

In `AiSettingsService`, remove these imports if unused after the edit:

```java
import com.fasterxml.jackson.core.type.TypeReference;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
```

Add:

```java
import com.weizhi.agent.data.SettingsStore;
```

Replace fields:

```java
private final ObjectMapper objectMapper;
private final OkHttpClient httpClient;

@Value("${settings.file:data/ai-settings.json}")
private String settingsFile;
```

with:

```java
private final SettingsStore settingsStore;
private final ObjectMapper objectMapper;
private final OkHttpClient httpClient;
```

Replace constructor:

```java
public AiSettingsService(ObjectMapper objectMapper, OkHttpClient okHttpClient) {
    this.objectMapper = objectMapper;
    this.httpClient = okHttpClient;
}
```

with:

```java
public AiSettingsService(SettingsStore settingsStore, ObjectMapper objectMapper, OkHttpClient okHttpClient) {
    this.settingsStore = settingsStore;
    this.objectMapper = objectMapper;
    this.httpClient = okHttpClient;
}
```

Replace all calls to:

```java
readStored()
writeStored(stored)
```

with:

```java
settingsStore.readStored()
settingsStore.writeStored(stored)
```

Delete the private `readStored()` and `writeStored(...)` methods from `AiSettingsService`.

- [ ] **Step 2: Run backend tests**

Run:

```bash
cd backend
./mvnw test
```

Expected: `BUILD SUCCESS`.

---

### Task 3: Add MediaHistoryStore and JSON Media History Store

**Files:**
- Create: `backend/src/main/java/com/weizhi/agent/data/MediaHistoryStore.java`
- Create: `backend/src/main/java/com/weizhi/agent/data/JsonMediaHistoryStore.java`
- Test: `backend/src/test/java/com/weizhi/agent/data/JsonMediaHistoryStoreTest.java`

- [ ] **Step 1: Write failing tests for media history store**

Create `backend/src/test/java/com/weizhi/agent/data/JsonMediaHistoryStoreTest.java`:

```java
package com.weizhi.agent.data;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.weizhi.agent.config.StorageProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class JsonMediaHistoryStoreTest {
    @TempDir
    Path tempDir;

    private JsonMediaHistoryStore newStore() {
        StorageProperties properties = new StorageProperties();
        properties.setImageDir(tempDir.resolve("images").toString());
        properties.setAudioDir(tempDir.resolve("audio").toString());
        properties.setImageHistoryFile(tempDir.resolve("data").resolve("image-history.json").toString());
        properties.setTtsHistoryFile(tempDir.resolve("data").resolve("tts-history.json").toString());
        return new JsonMediaHistoryStore(properties, new ObjectMapper());
    }

    @Test
    void appendImage_andGetImageHistory_roundTripsRecord() {
        JsonMediaHistoryStore store = newStore();

        store.appendImage("a prompt", "image.png", "/api/images/files/image.png", "image-01");

        List<Map<String, Object>> histories = store.getImageHistory();
        assertEquals(1, histories.size());
        assertEquals("a prompt", histories.get(0).get("prompt"));
        assertEquals("image.png", histories.get(0).get("filename"));
    }

    @Test
    void appendTts_andDeleteTtsHistory_updatesHistoryFile() {
        JsonMediaHistoryStore store = newStore();

        store.appendTts("hello", "voice", "speech-2.8-hd", "mp3", "/api/tts/audio/a.mp3", false, "manual");
        String id = String.valueOf(store.getTtsHistory().get(0).get("id"));

        assertTrue(store.deleteTtsHistory(id));
        assertTrue(store.getTtsHistory().isEmpty());
    }
}
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
cd backend
./mvnw -Dtest=JsonMediaHistoryStoreTest test
```

Expected: compilation fails because `JsonMediaHistoryStore` does not exist.

- [ ] **Step 3: Add `MediaHistoryStore` interface**

Create `backend/src/main/java/com/weizhi/agent/data/MediaHistoryStore.java`:

```java
package com.weizhi.agent.data;

import java.util.List;
import java.util.Map;

public interface MediaHistoryStore {
    void appendImage(String prompt, String filename, String url, String model);
    void appendTts(String text, String voiceId, String model, String format, String audioUrl, boolean preview, String source);
    List<Map<String, Object>> getImageHistory();
    List<Map<String, Object>> getTtsHistory();
    boolean deleteImageHistory(String id);
    boolean deleteTtsHistory(String id);
    void clearImageHistory();
    void clearTtsHistory();
}
```

- [ ] **Step 4: Move JSON history logic into `JsonMediaHistoryStore`**

Create `backend/src/main/java/com/weizhi/agent/data/JsonMediaHistoryStore.java`.

Implementation guidance:

- Annotate with `@Component`.
- Constructor dependencies: `StorageProperties storageProperties`, `ObjectMapper objectMapper`.
- Copy the current JSON read/write, append, delete, legacy image scan, physical file delete, and image extension checks from `HistoryService`.
- Keep all public methods `synchronized`, matching current behavior.
- Keep the `append` cap at 200 records.
- Keep generated media deletion behavior unchanged.

The class must implement `MediaHistoryStore`.

- [ ] **Step 5: Run the media store test**

Run:

```bash
cd backend
./mvnw -Dtest=JsonMediaHistoryStoreTest test
```

Expected: `BUILD SUCCESS`.

---

### Task 4: Refactor HistoryService to Use MediaHistoryStore

**Files:**
- Modify: `backend/src/main/java/com/weizhi/agent/service/HistoryService.java`
- Test: `backend/src/test/java/com/weizhi/agent/data/JsonMediaHistoryStoreTest.java`

- [ ] **Step 1: Replace HistoryService implementation with delegation**

Replace the body of `HistoryService` with:

```java
package com.weizhi.agent.service;

import com.weizhi.agent.data.MediaHistoryStore;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class HistoryService {
    private final MediaHistoryStore mediaHistoryStore;

    public HistoryService(MediaHistoryStore mediaHistoryStore) {
        this.mediaHistoryStore = mediaHistoryStore;
    }

    public void appendImage(String prompt, String filename, String url, String model) {
        mediaHistoryStore.appendImage(prompt, filename, url, model);
    }

    public void appendTts(String text, String voiceId, String model, String format, String audioUrl, boolean preview, String source) {
        mediaHistoryStore.appendTts(text, voiceId, model, format, audioUrl, preview, source);
    }

    public List<Map<String, Object>> getImageHistory() {
        return mediaHistoryStore.getImageHistory();
    }

    public List<Map<String, Object>> getTtsHistory() {
        return mediaHistoryStore.getTtsHistory();
    }

    public boolean deleteImageHistory(String id) {
        return mediaHistoryStore.deleteImageHistory(id);
    }

    public boolean deleteTtsHistory(String id) {
        return mediaHistoryStore.deleteTtsHistory(id);
    }

    public void clearImageHistory() {
        mediaHistoryStore.clearImageHistory();
    }

    public void clearTtsHistory() {
        mediaHistoryStore.clearTtsHistory();
    }
}
```

- [ ] **Step 2: Run backend tests**

Run:

```bash
cd backend
./mvnw test
```

Expected: `BUILD SUCCESS`.

---

### Task 5: Add Data Management Backend API

**Files:**
- Create: `backend/src/main/java/com/weizhi/agent/data/DataSourceMode.java`
- Create: `backend/src/main/java/com/weizhi/agent/service/DataManagementService.java`
- Create: `backend/src/main/java/com/weizhi/agent/controller/DataManagementController.java`
- Modify: `backend/src/main/resources/application.yml`
- Test: `backend/src/test/java/com/weizhi/agent/controller/DataManagementControllerTest.java`

- [ ] **Step 1: Write controller tests**

Create `backend/src/test/java/com/weizhi/agent/controller/DataManagementControllerTest.java`:

```java
package com.weizhi.agent.controller;

import com.weizhi.agent.service.DataManagementService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(DataManagementController.class)
class DataManagementControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DataManagementService dataManagementService;

    @Test
    void status_returnsCurrentMode() throws Exception {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("mode", "json");
        status.put("ready", true);
        when(dataManagementService.status()).thenReturn(status);

        mockMvc.perform(get("/api/data-management/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mode").value("json"))
                .andExpect(jsonPath("$.ready").value(true));
    }

    @Test
    void mode_rejectsPostgresqlWhenUnavailable() throws Exception {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", false);
        result.put("mode", "json");
        result.put("message", "PostgreSQL mode is visible but not ready in this phase.");
        when(dataManagementService.switchMode(eq("postgresql"))).thenReturn(result);

        mockMvc.perform(post("/api/data-management/mode")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"postgresql\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.mode").value("json"));
    }
}
```

- [ ] **Step 2: Run failing controller test**

Run:

```bash
cd backend
./mvnw -Dtest=DataManagementControllerTest test
```

Expected: compilation fails because the controller/service do not exist.

- [ ] **Step 3: Add data source enum**

Create `backend/src/main/java/com/weizhi/agent/data/DataSourceMode.java`:

```java
package com.weizhi.agent.data;

public enum DataSourceMode {
    JSON("json"),
    POSTGRESQL("postgresql");

    private final String value;

    DataSourceMode(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    public static DataSourceMode from(String raw) {
        if (raw == null) return JSON;
        String normalized = raw.trim().toLowerCase();
        for (DataSourceMode mode : values()) {
            if (mode.value.equals(normalized)) return mode;
        }
        return JSON;
    }
}
```

- [ ] **Step 4: Add configuration value**

Append to `backend/src/main/resources/application.yml`:

```yaml
data-management:
  mode: ${WEIZHI_DATA_SOURCE_MODE:json}
```

- [ ] **Step 5: Add data management service**

Create `backend/src/main/java/com/weizhi/agent/service/DataManagementService.java`:

```java
package com.weizhi.agent.service;

import com.weizhi.agent.config.StorageProperties;
import com.weizhi.agent.data.DataSourceMode;
import com.weizhi.agent.data.JsonSettingsStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class DataManagementService {
    private final JsonSettingsStore jsonSettingsStore;
    private final StorageProperties storageProperties;
    private DataSourceMode mode;

    public DataManagementService(
            JsonSettingsStore jsonSettingsStore,
            StorageProperties storageProperties,
            @Value("${data-management.mode:json}") String configuredMode
    ) {
        this.jsonSettingsStore = jsonSettingsStore;
        this.storageProperties = storageProperties;
        this.mode = DataSourceMode.from(configuredMode);
        if (this.mode == DataSourceMode.POSTGRESQL) {
            this.mode = DataSourceMode.JSON;
        }
    }

    public synchronized Map<String, Object> status() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("mode", mode.value());
        result.put("ready", true);
        result.put("json", jsonStatus());
        result.put("postgresql", postgresqlStatus());
        return result;
    }

    public synchronized Map<String, Object> switchMode(String requestedMode) {
        DataSourceMode requested = DataSourceMode.from(requestedMode);
        Map<String, Object> result = new LinkedHashMap<>();
        if (requested == DataSourceMode.POSTGRESQL) {
            mode = DataSourceMode.JSON;
            result.put("success", false);
            result.put("mode", mode.value());
            result.put("message", "PostgreSQL mode is visible but not ready in this phase.");
            result.put("status", status());
            return result;
        }
        mode = DataSourceMode.JSON;
        result.put("success", true);
        result.put("mode", mode.value());
        result.put("message", "JSON file mode is active.");
        result.put("status", status());
        return result;
    }

    public synchronized Map<String, Object> testConnection(String requestedMode) {
        DataSourceMode requested = DataSourceMode.from(requestedMode);
        if (requested == DataSourceMode.POSTGRESQL) {
            return Map.of(
                    "success", false,
                    "mode", "postgresql",
                    "message", "PostgreSQL connection testing will be available after the database store is implemented."
            );
        }
        return Map.of(
                "success", true,
                "mode", "json",
                "message", "JSON files are available.",
                "json", jsonStatus()
        );
    }

    private Map<String, Object> jsonStatus() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("settings", fileInfo(jsonSettingsStore.getSettingsFile(), "object"));
        status.put("imageHistory", fileInfo(storageProperties.getImageHistoryFile(), "array"));
        status.put("ttsHistory", fileInfo(storageProperties.getTtsHistoryFile(), "array"));
        return status;
    }

    private Map<String, Object> postgresqlStatus() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("configured", false);
        status.put("available", false);
        status.put("ready", false);
        status.put("message", "PostgreSQL store is planned for the next phase.");
        return status;
    }

    private Map<String, Object> fileInfo(String filePath, String shape) {
        Map<String, Object> info = new LinkedHashMap<>();
        Path path = Paths.get(filePath).toAbsolutePath().normalize();
        info.put("path", path.toString());
        info.put("exists", Files.exists(path));
        info.put("recordCount", recordCount(path, shape));
        return info;
    }

    private int recordCount(Path path, String shape) {
        if (!Files.exists(path)) return 0;
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            if ("array".equals(shape)) {
                List<?> list = mapper.readValue(path.toFile(), List.class);
                return list.size();
            }
            Map<?, ?> map = mapper.readValue(path.toFile(), Map.class);
            return map.size();
        } catch (Exception ignored) {
            return 0;
        }
    }
}
```

- [ ] **Step 6: Add controller**

Create `backend/src/main/java/com/weizhi/agent/controller/DataManagementController.java`:

```java
package com.weizhi.agent.controller;

import com.weizhi.agent.service.DataManagementService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/data-management")
public class DataManagementController {
    private final DataManagementService dataManagementService;

    public DataManagementController(DataManagementService dataManagementService) {
        this.dataManagementService = dataManagementService;
    }

    @GetMapping("/status")
    public Map<String, Object> status() {
        return dataManagementService.status();
    }

    @PostMapping("/mode")
    public Map<String, Object> mode(@RequestBody Map<String, Object> body) {
        return dataManagementService.switchMode(String.valueOf(body.getOrDefault("mode", "json")));
    }

    @PostMapping("/test-connection")
    public Map<String, Object> testConnection(@RequestBody(required = false) Map<String, Object> body) {
        String mode = body == null ? "json" : String.valueOf(body.getOrDefault("mode", "json"));
        return dataManagementService.testConnection(mode);
    }
}
```

- [ ] **Step 7: Run backend tests**

Run:

```bash
cd backend
./mvnw test
```

Expected: `BUILD SUCCESS`.

---

### Task 6: Add Frontend API and i18n Labels

**Files:**
- Modify: `frontend/src/utils/api.ts`
- Modify: `frontend/src/locales/zh-CN.json`
- Modify: `frontend/src/locales/zh-TW.json`
- Modify: `frontend/src/locales/en-US.json`

- [ ] **Step 1: Add data management API client**

In `frontend/src/utils/api.ts`, after `settingsApi`, add:

```ts
export type DataSourceMode = 'json' | 'postgresql';

export type DataManagementStatus = {
    mode: DataSourceMode;
    ready: boolean;
    json?: Record<string, any>;
    postgresql?: Record<string, any>;
};

export const dataManagementApi = {
    status: () => api.get<DataManagementStatus>('/data-management/status'),
    switchMode: (mode: DataSourceMode) => api.post('/data-management/mode', { mode }),
    testConnection: (mode: DataSourceMode) => api.post('/data-management/test-connection', { mode })
};
```

- [ ] **Step 2: Add Simplified Chinese labels**

In `frontend/src/locales/zh-CN.json`, add `dataManagement` under `nav`:

```json
"dataManagement": "数据管理"
```

Add a top-level `dataManagement` object:

```json
"dataManagement": {
  "title": "数据管理",
  "desc": "选择本地数据来源，查看 JSON 文件状态，并为 PostgreSQL 数据库模式做准备。",
  "currentMode": "当前数据源",
  "jsonMode": "JSON 文件",
  "postgresqlMode": "PostgreSQL",
  "jsonStatus": "JSON 文件状态",
  "postgresqlStatus": "PostgreSQL 状态",
  "settingsFile": "设置文件",
  "imageHistory": "图片历史",
  "ttsHistory": "语音历史",
  "exists": "存在",
  "missing": "不存在",
  "records": "条记录",
  "testConnection": "测试连接",
  "switchSuccess": "数据源已切换",
  "switchFailed": "数据源切换失败",
  "connectionSuccess": "连接可用",
  "connectionFailed": "连接不可用",
  "postgresqlUnavailable": "PostgreSQL 模式将在数据库存储实现后启用。"
}
```

- [ ] **Step 3: Add Traditional Chinese labels**

In `frontend/src/locales/zh-TW.json`, add `dataManagement` under `nav`:

```json
"dataManagement": "資料管理"
```

Add a top-level `dataManagement` object:

```json
"dataManagement": {
  "title": "資料管理",
  "desc": "選擇本機資料來源，檢視 JSON 檔案狀態，並為 PostgreSQL 資料庫模式做準備。",
  "currentMode": "目前資料來源",
  "jsonMode": "JSON 檔案",
  "postgresqlMode": "PostgreSQL",
  "jsonStatus": "JSON 檔案狀態",
  "postgresqlStatus": "PostgreSQL 狀態",
  "settingsFile": "設定檔案",
  "imageHistory": "圖片歷史",
  "ttsHistory": "語音歷史",
  "exists": "存在",
  "missing": "不存在",
  "records": "筆記錄",
  "testConnection": "測試連線",
  "switchSuccess": "資料來源已切換",
  "switchFailed": "資料來源切換失敗",
  "connectionSuccess": "連線可用",
  "connectionFailed": "連線不可用",
  "postgresqlUnavailable": "PostgreSQL 模式會在資料庫儲存實作後啟用。"
}
```

- [ ] **Step 4: Add English labels**

In `frontend/src/locales/en-US.json`, add `dataManagement` under `nav`:

```json
"dataManagement": "Data Management"
```

Add a top-level `dataManagement` object:

```json
"dataManagement": {
  "title": "Data Management",
  "desc": "Choose the local data source, inspect JSON file status, and prepare for PostgreSQL database mode.",
  "currentMode": "Current data source",
  "jsonMode": "JSON Files",
  "postgresqlMode": "PostgreSQL",
  "jsonStatus": "JSON File Status",
  "postgresqlStatus": "PostgreSQL Status",
  "settingsFile": "Settings File",
  "imageHistory": "Image History",
  "ttsHistory": "TTS History",
  "exists": "Exists",
  "missing": "Missing",
  "records": "records",
  "testConnection": "Test Connection",
  "switchSuccess": "Data source switched",
  "switchFailed": "Data source switch failed",
  "connectionSuccess": "Connection available",
  "connectionFailed": "Connection unavailable",
  "postgresqlUnavailable": "PostgreSQL mode will be enabled after database storage is implemented."
}
```

- [ ] **Step 5: Run frontend type/build check**

Run:

```bash
cd frontend
npm run build
```

Expected: `built in ...` and no TypeScript errors.

---

### Task 7: Add Data Management UI

**Files:**
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/components/layout/FloatingSidebar.vue`

- [ ] **Step 1: Import API types and client**

In `frontend/src/App.vue`, update the API import to include:

```ts
dataManagementApi,
type DataManagementStatus,
type DataSourceMode
```

- [ ] **Step 2: Extend `MainView`**

Add `dataManagement` to the `MainView` union:

```ts
type MainView = "home" | "chat" | "speech" | "translation" | "imageHistory" | "ttsHistory" | "sessions" | "tasks" | "notifications" | "prompts" | "assets" | "favorites" | "diagnostics" | "exports" | "apiStatus" | "logs" | "settings" | "dataManagement";
```

- [ ] **Step 3: Add data management state and helpers**

Near other page state in `App.vue`, add:

```ts
const dataManagementStatus = ref<DataManagementStatus | null>(null);
const dataManagementLoading = ref(false);
const selectedDataMode = ref<DataSourceMode>("json");

const dataFileCards = computed(() => {
  const json = dataManagementStatus.value?.json || {};
  return [
    { key: "settings", label: t("dataManagement.settingsFile"), info: json.settings || {} },
    { key: "imageHistory", label: t("dataManagement.imageHistory"), info: json.imageHistory || {} },
    { key: "ttsHistory", label: t("dataManagement.ttsHistory"), info: json.ttsHistory || {} }
  ];
});

const loadDataManagementStatus = async () => {
  dataManagementLoading.value = true;
  try {
    const res = await dataManagementApi.status();
    dataManagementStatus.value = res.data;
    selectedDataMode.value = res.data?.mode || "json";
  } catch (err: any) {
    addNotification("error", t("dataManagement.connectionFailed"), err?.message || "unknown error");
  } finally {
    dataManagementLoading.value = false;
  }
};

const switchDataSourceMode = async (mode: DataSourceMode) => {
  selectedDataMode.value = mode;
  dataManagementLoading.value = true;
  try {
    const res = await dataManagementApi.switchMode(mode);
    if (res.data?.status) dataManagementStatus.value = res.data.status;
    selectedDataMode.value = res.data?.mode || dataManagementStatus.value?.mode || "json";
    addNotification(res.data?.success ? "success" : "warning", res.data?.success ? t("dataManagement.switchSuccess") : t("dataManagement.switchFailed"), res.data?.message || "");
  } catch (err: any) {
    selectedDataMode.value = dataManagementStatus.value?.mode || "json";
    addNotification("error", t("dataManagement.switchFailed"), err?.message || "unknown error");
  } finally {
    dataManagementLoading.value = false;
  }
};

const testDataConnection = async () => {
  dataManagementLoading.value = true;
  try {
    const res = await dataManagementApi.testConnection(selectedDataMode.value);
    addNotification(res.data?.success ? "success" : "warning", res.data?.success ? t("dataManagement.connectionSuccess") : t("dataManagement.connectionFailed"), res.data?.message || "");
    await loadDataManagementStatus();
  } catch (err: any) {
    addNotification("error", t("dataManagement.connectionFailed"), err?.message || "unknown error");
  } finally {
    dataManagementLoading.value = false;
  }
};

const openDataManagement = () => {
  activeView.value = "dataManagement";
  loadDataManagementStatus();
};
```

- [ ] **Step 4: Provide the navigation method**

In the `provide('appState', { ... })` object, add:

```ts
openDataManagement
```

- [ ] **Step 5: Add sidebar navigation item**

In `frontend/src/components/layout/FloatingSidebar.vue`, add `Database` to the lucide import:

```ts
import { Terminal, Home, Bell, BookOpen, Activity, FolderOpen, Star, Wrench, Download, FileText, Settings, History, Trash2, Cpu, Image as ImageIcon, Volume2, Database } from 'lucide-vue-next';
```

Add this button near API Status / Model Settings:

```vue
<button class="nav-item" :class="{ active: appState.activeView.value === 'dataManagement' }" @click="appState.openDataManagement">
  <Database :size="16" /> {{ $t('nav.dataManagement') }}
</button>
```

- [ ] **Step 6: Add Data Management page markup**

In `App.vue`, add a new section before the logs/settings sections:

```vue
<section v-else-if="activeView === 'dataManagement'" class="module-page">
  <div class="module-header">
    <div>
      <h2>{{ $t("dataManagement.title") }}</h2>
      <p>{{ $t("dataManagement.desc") }}</p>
    </div>
    <div class="page-controls">
      <button class="log-action" :disabled="dataManagementLoading" @click="loadDataManagementStatus">
        {{ $t("apiStatus.refresh") }}
      </button>
      <button class="log-action" :disabled="dataManagementLoading" @click="testDataConnection">
        {{ $t("dataManagement.testConnection") }}
      </button>
    </div>
  </div>

  <div class="module-body status-layout">
    <article class="status-card wide-status">
      <span>{{ $t("dataManagement.currentMode") }}</span>
      <div class="provider-toggle">
        <button class="toggle-pill" :class="{ active: selectedDataMode === 'json' }" :disabled="dataManagementLoading" @click="switchDataSourceMode('json')">
          {{ $t("dataManagement.jsonMode") }}
        </button>
        <button class="toggle-pill" :class="{ active: selectedDataMode === 'postgresql' }" :disabled="dataManagementLoading" @click="switchDataSourceMode('postgresql')">
          {{ $t("dataManagement.postgresqlMode") }}
        </button>
      </div>
      <p>{{ dataManagementStatus?.postgresql?.message || $t("dataManagement.postgresqlUnavailable") }}</p>
    </article>

    <article v-for="card in dataFileCards" :key="card.key" class="status-card">
      <span>{{ card.label }}</span>
      <strong>{{ card.info.exists ? $t("dataManagement.exists") : $t("dataManagement.missing") }}</strong>
      <p>{{ card.info.recordCount || 0 }} {{ $t("dataManagement.records") }}</p>
      <small>{{ card.info.path || "" }}</small>
    </article>

    <article class="status-card">
      <span>{{ $t("dataManagement.postgresqlStatus") }}</span>
      <strong>{{ dataManagementStatus?.postgresql?.ready ? $t("apiStatus.statusOk") : $t("apiStatus.statusPending") }}</strong>
      <p>{{ dataManagementStatus?.postgresql?.message || $t("dataManagement.postgresqlUnavailable") }}</p>
    </article>
  </div>
</section>
```

- [ ] **Step 7: Run frontend build**

Run:

```bash
cd frontend
npm run build
```

Expected: `built in ...` and no TypeScript errors.

---

### Task 8: Verification and User Test Handoff

**Files:**
- No source edits required unless verification finds a defect.

- [ ] **Step 1: Run backend verification**

Run:

```bash
cd backend
./mvnw test
```

Expected: `BUILD SUCCESS`.

- [ ] **Step 2: Run frontend verification**

Run:

```bash
cd frontend
npm run build
```

Expected: `built in ...`.

- [ ] **Step 3: Start backend and frontend for manual testing**

Run backend:

```bash
cd backend
./mvnw spring-boot:run
```

Run frontend in another terminal:

```bash
cd frontend
npm run dev -- --host 127.0.0.1
```

Expected:

- Backend listens on `http://localhost:3017`.
- Frontend listens on `http://127.0.0.1:5191`.

- [ ] **Step 4: Manual test checklist for the user**

Ask the user to test:

1. Open `http://127.0.0.1:5191`.
2. Click `数据管理`.
3. Confirm current data source is `JSON 文件`.
4. Confirm settings/image/TTS status cards show file paths and record counts.
5. Click `测试连接` while JSON is selected and confirm success notification.
6. Click `PostgreSQL` and confirm it does not silently switch to database mode.
7. Confirm a warning says PostgreSQL is not ready in this phase.
8. Return to image history / TTS history / settings and confirm existing data still appears.

- [ ] **Step 5: Stop dev servers**

Stop the backend and frontend processes that were started for manual testing.

- [ ] **Step 6: Wait for user approval before committing**

Do not run `git commit`. Report:

```text
Implementation is ready for your manual test. After you confirm the feature works, I can commit these changes.
```

Expected: no new commit is created until the user explicitly approves.

---

## Self-Review Checklist

- Spec coverage: store abstraction, JSON default mode, PostgreSQL unavailable mode, backend API, frontend data management UI, and testing are each covered by tasks.
- Scope control: no Docker Compose, JDBC, JPA, MyBatis, migration execution, or PostgreSQL repositories are included in this phase.
- User Git rule: plan explicitly says not to commit implementation changes until the user manually tests and approves.
- Type consistency: frontend uses `DataSourceMode = 'json' | 'postgresql'`; backend enum uses `json` and `postgresql` string values.
- Verification: backend `./mvnw test`, frontend `npm run build`, and manual browser checks are included.
