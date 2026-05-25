# Data Management Source Switch Design

## Goal

Weizhi Agent v2 will introduce a local data management layer that can run against the current JSON files now and a PostgreSQL Docker database later. The first implementation keeps existing JSON behavior as the default, adds clear backend boundaries for data-source selection, and exposes a frontend "Data Management" page where users can see and choose the intended data source.

The immediate user-facing result is a real data-source management surface, not a fake database migration. PostgreSQL is visible as the target architecture, but switching to it must fail clearly until the PostgreSQL store is implemented and available.

## Current State

The backend currently persists local state through JSON files and disk folders:

- AI provider settings: `data/ai-settings.json`
- Image history: `data/image-history.json`
- TTS history: `data/tts-history.json`
- Generated images/audio: local file directories configured by `storage.*` and `app.generated-images-path`

There is no JDBC, JPA, MyBatis, PostgreSQL driver, migration tool, or Docker Compose database setup in the current backend.

## Architecture

Add a backend data-source mode abstraction:

- `json`: current default and fully supported mode.
- `postgresql`: future database-backed mode. It is visible in status responses and UI, but not considered ready until a PostgreSQL-backed store exists and the connection passes validation.

Introduce store interfaces behind existing services:

- `SettingsStore`: reads and writes provider settings such as API keys, base URLs, selected models, and source metadata.
- `MediaHistoryStore`: reads and writes image history and TTS history metadata.

The first implementation provides JSON-backed stores:

- `JsonSettingsStore`
- `JsonMediaHistoryStore`

The existing services, such as `AiSettingsService` and `HistoryService`, should depend on these store interfaces instead of directly reading and writing JSON files. Controllers should continue to use the service APIs they use today.

Future PostgreSQL work can add:

- `PostgresSettingsStore`
- `PostgresMediaHistoryStore`
- Additional stores for sessions, favorites, tasks, logs, and other local state.

Generated media files remain on disk in this design. The stores persist metadata, paths, URLs, model names, timestamps, and source information.

## Backend API

Add a new data management controller under `/api/data-management`.

`GET /api/data-management/status`

Returns:

- Current data source mode.
- Whether the current mode is ready.
- JSON file status: configured file paths, file existence, and record counts for known JSON-backed data.
- PostgreSQL status: configured or not, available or not, and a user-readable reason when unavailable.

`POST /api/data-management/mode`

Request body:

```json
{
  "mode": "json"
}
```

or:

```json
{
  "mode": "postgresql"
}
```

Behavior:

- Switching to `json` is allowed.
- Switching to `postgresql` is rejected until PostgreSQL support is implemented and the connection is ready.
- Rejection must be explicit, with a message that tells users PostgreSQL is reserved for the next stage.

`POST /api/data-management/test-connection`

Behavior in this phase:

- For `json`, returns successful local file status.
- For `postgresql`, returns a clear "not implemented or not configured" status.

## Frontend UI

Add a "Data Management" entry in the sidebar near "Model Settings" or "API Status".

The page should show:

- Current data source mode.
- A segmented control or switch for `JSON Files` and `PostgreSQL`.
- JSON status cards:
  - Settings file path and existence.
  - Image history file path and record count.
  - TTS history file path and record count.
- PostgreSQL status card:
  - Connection status.
  - Readiness state.
  - Reason if unavailable.
- A "Test Connection" action.

When a user selects PostgreSQL before it is ready:

- Do not silently switch.
- Show a clear message that PostgreSQL mode is planned but not active yet.
- Keep the current mode as JSON.

## Data Flow

In JSON mode:

1. Frontend calls existing feature APIs.
2. Controllers call existing services.
3. Services call store interfaces.
4. JSON store implementations read and write current JSON files.
5. File serving and generated media directories continue unchanged.

In future PostgreSQL mode:

1. Frontend calls the same feature APIs.
2. Controllers and services remain unchanged.
3. Store selection routes calls to PostgreSQL-backed implementations.
4. Media files still live on disk; PostgreSQL stores metadata.

## Error Handling

Data management responses should distinguish:

- Unsupported mode.
- PostgreSQL not implemented.
- PostgreSQL configured but unreachable.
- JSON file missing.
- JSON parse/read errors.

The UI should show these as user-readable status messages. It should not display raw stack traces or ambiguous network errors as if they were valid data.

## Testing

Backend tests:

- Data management status returns JSON mode by default.
- JSON status counts current image and TTS history records.
- Switching to JSON succeeds.
- Switching to PostgreSQL fails clearly while PostgreSQL store is unavailable.
- Existing settings and history service tests continue to pass through the store abstraction.

Frontend tests:

- Data Management page renders current JSON status.
- Selecting PostgreSQL shows unavailable feedback and preserves JSON mode.
- Test Connection displays JSON success or PostgreSQL unavailable state.

Manual verification:

- Start backend on `3017` and frontend on `5191`.
- Confirm existing chat/history/TTS/image pages still read current JSON-backed data.
- Confirm the Data Management page reports JSON as active.
- Confirm PostgreSQL cannot be selected as active until implemented.

## Out Of Scope For This Phase

- Docker Compose PostgreSQL container.
- JDBC/JPA/MyBatis dependencies.
- Database schema migrations.
- JSON-to-PostgreSQL migration execution.
- PostgreSQL-backed repositories.
- Storing media file binary content in the database.

Those belong to the next implementation phase after the source-switch boundary is in place.
