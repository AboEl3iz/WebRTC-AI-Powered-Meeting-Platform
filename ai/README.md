<![CDATA[# 🧠 AI Service — Meeting Intelligence Pipeline

> An intelligent meeting processing service built with **Python**, **FastAPI**, **LangGraph**, **Whisper**, and **LLMs**, featuring automated transcription, summarization, event extraction, and distribution to **Notion** and **Google Calendar** via an MCP (Model Context Protocol) layer.

---

## 📖 Overview

The AI service is an event-driven microservice that automatically processes meeting recordings. When a recording is completed and uploaded to MinIO, the backend publishes a `recording.completed` event to RabbitMQ. The AI service consumes this event, downloads the recording, and runs it through a multi-stage LangGraph pipeline that extracts audio, transcribes it, refines the transcript, generates a summary, extracts calendar events, and distributes the results to each participant's connected services (Notion, Google Calendar).

---

## ✨ Features

### 🎙️ Audio Processing
- **Audio Extraction** — Extracts the audio track from the composite MP4 recording using FFmpeg.
- **Audio Cleaning** — Applies noise reduction and audio normalization to improve transcription accuracy.

### 📝 Transcription
- **Whisper-Based Transcription** — Uses the Whisper speech-to-text model (via `faster-whisper` and `whisperx`) for high-accuracy, multi-language transcription.
- **Segment-Level Output** — Produces timestamped transcript segments for precise alignment.
- **Egyptian Arabic Support** — Fine-tuned model support (`nabbra/whisper-medium-egyptian-arabic`) for Arabic dialect transcription.

### ✍️ Transcript Refinement
- **LLM-Powered Refinement** — Uses a large language model to clean up transcription artifacts, fix grammar, and improve readability while preserving the original meaning.

### 📋 Meeting Summarization
- **Intelligent Summarization** — Generates concise, structured meeting summaries using LLMs, capturing key discussion points, decisions, and action items.

### 📅 Event Extraction
- **Heuristic-Based Gating** — Before invoking the LLM, a fast heuristic check determines if the transcript likely contains schedulable events (to avoid unnecessary API calls).
- **LLM Event Extraction** — When events are detected, the LLM extracts structured calendar event data (title, date, time, description) from the transcript.
- **Conditional Pipeline Edge** — LangGraph's conditional edges route the pipeline to skip event extraction when no events are detected.

### 🔄 Distribution (MCP — Model Context Protocol)
- **Per-Participant Distribution** — Meeting outputs are distributed individually to each participant based on their connected integrations.
- **Notion Integration** — Automatically creates a Notion page with the meeting summary, full transcript, and extracted events in the participant's workspace.
- **Google Calendar Integration** — Creates calendar events in the participant's Google Calendar for any scheduled follow-ups extracted from the meeting.
- **Error Isolation** — If one participant's integration fails, it doesn't affect other participants' distributions.

### 🐇 Event-Driven Architecture
- **RabbitMQ Consumer** — Listens on the `recording.completed` queue for new recording events.
- **Automatic Pipeline Trigger** — Each event automatically downloads the recording from MinIO and triggers the full pipeline.
- **Fallback Mode** — If RabbitMQ is unavailable, the service still runs with a manual `/process` REST endpoint.

### 🔌 LLM Provider Flexibility
- **Provider Factory Pattern** — Supports multiple LLM backends through a factory pattern.
- **OpenAI** — Integration with OpenAI's GPT models.
- **Google GenAI** — Integration with Google's Gemini models.
- **Ollama** — Support for locally hosted models via Ollama for offline/privacy-sensitive deployments.

### 📡 REST API
- **Manual Processing Endpoint** — `POST /api/v1/process` allows manual file upload and pipeline execution for testing and development.
- **MCP Distribution Endpoint** — `POST /api/v1/mcp/distribute` allows manual triggering of the distribution step with pre-computed meeting data.

---

## 🏗️ Tech Stack

| Technology | Purpose |
|---|---|
| **Python 3.12+** | Runtime |
| **FastAPI** | REST API framework |
| **LangGraph** | Pipeline orchestration (DAG-based state machine) |
| **LangChain** | LLM abstraction layer |
| **Whisper / WhisperX** | Speech-to-text transcription |
| **faster-whisper** | Optimized Whisper inference |
| **OpenAI SDK** | GPT model integration |
| **Google GenAI** | Gemini model integration |
| **aio-pika** | Async RabbitMQ client |
| **boto3** | MinIO/S3 file download |
| **Notion Client** | Notion API integration |
| **Google Calendar API** | Calendar event creation |
| **FFmpeg (ffmpeg-python)** | Audio extraction & processing |
| **Pydantic** | Data validation & models |

---

## 📂 Project Structure

```
ai/
├── app/
│   └── core/
│       ├── audio/
│       │   ├── extractor.py            # FFmpeg audio extraction from video
│       │   └── cleaner.py              # Audio noise reduction & normalization
│       ├── transcription/
│       │   ├── whisper_service.py       # Whisper/WhisperX transcription engine
│       │   └── early_patch.py          # Runtime patches for model loading
│       ├── llm/
│       │   ├── base.py                 # Abstract LLM interface
│       │   ├── factory.py              # LLM provider factory
│       │   └── providers/
│       │       ├── openai_llm.py       # OpenAI GPT provider
│       │       ├── google_llm.py       # Google Gemini provider
│       │       └── ollama_llm.py       # Ollama local model provider
│       ├── ai/
│       │   ├── summarizer.py           # Meeting summarization logic
│       │   └── event_extractor.py      # Calendar event extraction
│       ├── pipelines/
│       │   ├── state.py                # LangGraph pipeline state definition
│       │   ├── graph.py                # Pipeline DAG construction
│       │   └── nodes/
│       │       ├── extract_audio.py    # Node: extract audio from video
│       │       ├── clean_audio.py      # Node: clean/normalize audio
│       │       ├── transcribe.py       # Node: run Whisper transcription
│       │       ├── refine_transcript.py# Node: LLM transcript refinement
│       │       ├── summarize.py        # Node: generate meeting summary
│       │       ├── extract_events.py   # Node: extract calendar events
│       │       └── distribute.py       # Node: distribute to integrations
│       ├── messaging/
│       │   ├── rabbitmq.py             # RabbitMQ connection management
│       │   └── consumer.py            # Event consumer & pipeline trigger
│       ├── storage/
│       │   └── minio_client.py         # MinIO download client
│       └── logging_config.py           # Structured logging setup
├── mcp/
│   ├── models.py                       # MCP data models (MeetingData, Participant)
│   ├── processor.py                    # MCP distribution processor
│   ├── router.py                       # FastAPI router for MCP endpoints
│   └── tools/
│       ├── notion.py                   # Notion page creation tool
│       └── google_calendar.py          # Google Calendar event creation tool
├── api/
│   └── routes/
│       └── process.py                  # Manual processing endpoint
├── main.py                             # FastAPI app entry point
├── pyproject.toml
├── requirements.txt
└── .env
```

---

## 🚀 Getting Started

### Prerequisites
- **Python** ≥ 3.12
- **FFmpeg** installed and available on `PATH`
- **uv** (recommended) or **pip** for dependency management
- **Docker** (for RabbitMQ & MinIO infrastructure)

### Infrastructure Setup

Ensure RabbitMQ and MinIO are running (from the project root):

```bash
docker compose up -d
```

### Installation & Development

```bash
cd ai

# Using uv (recommended)
uv sync
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Or using pip
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The API starts at `http://localhost:8000`.

### Environment Variables

Create a `.env` file in the `ai/` directory:

```env
# LLM Configuration
LLM_PROVIDER=openai          # Options: openai, google, ollama
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...

# RabbitMQ
RABBITMQ_URL=amqp://admin:admin@localhost:5672

# MinIO
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=karim123
MINIO_SECRET_KEY=karim123
MINIO_BUCKET=recordings

# Whisper
WHISPER_MODEL=medium
```

---

## 🔄 Pipeline Flow

```
┌─────────────────┐
│  Extract Audio   │ ── Extract audio track from MP4 using FFmpeg
└────────┬────────┘
         ▼
┌─────────────────┐
│  Clean Audio     │ ── Noise reduction & normalization
└────────┬────────┘
         ▼
┌─────────────────┐
│  Transcribe      │ ── Whisper speech-to-text (segment-level)
└────────┬────────┘
         ▼
┌─────────────────┐
│ Refine Transcript│ ── LLM cleans up transcription artifacts
└────────┬────────┘
         ▼
┌─────────────────┐
│  Summarize       │ ── LLM generates structured meeting summary
└────────┬────────┘
         ▼
    ┌────┴────┐
    │Heuristic│ ── Quick check: does transcript contain events?
    └────┬────┘
    ▼ Yes    ▼ No
┌──────────┐  │
│ Extract  │  │
│  Events  │  │
└────┬─────┘  │
     ▼        ▼
┌─────────────────┐
│  Distribute      │ ── Push to Notion & Google Calendar per participant
└─────────────────┘
```

---

## 📎 Related

- [🖥️ Frontend (Video Conferencing UI)](../frontend/README.md)
- [📡 Backend (Signaling & Media Server)](../backend/README.md)
- [📘 Full Project Overview](../README.md)
]]>
