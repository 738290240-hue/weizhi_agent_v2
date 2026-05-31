# Weizhi Agent v2 🚀

Weizhi Agent v2 is a state-of-the-art, full-stack, multi-agent AI workspace designed to integrate multiple leading large language models (LLMs) and advanced multi-modal tools into a unified, ultra-premium web-based interface. It serves as a comprehensive, intelligent cockpit for multi-turn conversational chat, smart model routing, real-time web search, document-based Retrieval-Augmented Generation (RAG), high-quality text-to-speech (TTS) synthesis, and image generation.

The project is built with a modern tech stack, featuring a high-performance **Spring Boot 3** backend and a sleek, beautifully animated **Vue 3** frontend with a gorgeous glassmorphic/dark-mode theme.

---

## ✨ Features & Capabilities

- **Unified Multi-Provider Support**: Seamlessly orchestrate and switch between:
  - **Gemini**: State-of-the-art multi-modal capabilities.
  - **Claude**: Deep logical reasoning, advanced coding support, and flagship intelligence (Opus, Sonnet, Haiku).
  - **OpenAI**: Universal reasoning and GPT-4 / o1 / o3 flagship models.
  - **DeepSeek**: High-performance thinking, deep analysis, and R1 / V3 models.
  - **MiniMax**: Professional image creation and state-of-the-art voice synthesis.
- **AI-Powered Cockpit Tools**:
  - **Smart Model Routing**: Auto-routing technology that selects the optimal model based on prompt complexity, coding requirements, or image creation needs.
  - **Retrieval-Augmented Generation (RAG)**: Fully integrated local knowledge base. Upload documents (PDFs, Markdown, text), chunk them, store them in PostgreSQL, and ask questions with precise vector retrieval.
  - **Real-time Web Search**: Integrated search tools allowing LLMs to search the web dynamically for up-to-date real-time intelligence.
  - **Server-Sent Events (SSE) Streaming**: Real-time "typewriter" response streaming for ultra-fast, smooth interactive chats.
  - **Text-to-Image Generation**: Create stunning visual assets directly from the conversation.
  - **Text-to-Speech (TTS)**: Professional audio generation with granular controls (speed, pitch, volume, audio format) and voice library previewing.
  - **AI Translation Workbench**: Dynamic, multi-lingual parallel translation desk integrating TTS speech synthesis.
- **Cockpit Operations**:
  - **Asset & File Library**: Structured repository of all generated images, voice clips, and documents.
  - **System Diagnostics**: Real-time monitoring of backend health, API connectivity, active task queues, and storage status.
  - **Robust Settings Console**: Dynamically configure API keys, update active base URLs, and inspect model latency & availability.

---

## 🛠️ Technology Stack

- **Backend**:
  - Java 21
  - Spring Boot 3 & Spring AI
  - Spring Security & WebFlux
  - PostgreSQL (Vector RAG storage & session connectivity)
  - OkHttp3 / Jackson
- **Frontend**:
  - Vue 3 (Composition API)
  - TypeScript
  - Vite
  - Vanilla CSS with premium glassmorphism, responsive CSS variables, and fluid transitions.

---

## 🚀 Getting Started

Follow these instructions to get the Weizhi Agent v2 cockpit up and running locally.

### Prerequisites

- **JDK 21** or later
- **Node.js 20** or later
- **PostgreSQL** 15+ (with `pgvector` extension for RAG support)
- **Maven** 3.9+

### 1. Database Configuration

1. Create a PostgreSQL database named `weizhi_agent`.
2. Ensure you have the `pgvector` extension installed or enabled on your database:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

### 2. Backend Setup

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```
2. **Configure Environment Variables**:
   Create a `.env` file in the `backend` directory:
   ```dotenv
   # .env
   SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/weizhi_agent
   SPRING_DATASOURCE_USERNAME=your_db_user
   SPRING_DATASOURCE_PASSWORD=your_db_password
   
   MINIMAX_API_KEY=your_minimax_key
   DEEPSEEK_API_KEY=your_deepseek_key
   GEMINI_API_KEY=your_gemini_key
   OPENAI_API_KEY=your_openai_key
   ```
3. **Run the backend application**:
   ```bash
   ./mvnw spring-boot:run
   ```
   The backend server will start on **`http://localhost:3017`**.

### 3. Frontend Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Run the development server**:
   ```bash
   npm run dev
   ```
   The frontend dev server will launch at **`http://localhost:5173`**. Open it in your browser and experience the ultimate AI workspace!

---

## ⚙️ Configuration & Orchestration

- **Startup Probing**: On application startup, Weizhi Agent v2 automatically probes the configured Gemini/API endpoints to detect which models are accessible, fetching real-time latency and status codes to filter out unavailable models.
- **Storage Directory**: All generated materials, audio clips, and uploaded RAG documents are organized inside the `backend/generated_documents/` and storage directories configured in `application.yml`.
