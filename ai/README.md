# WebRTC + AI application

### 📂 Proposed Project Structure (OOP Style)

``` bash

ai-meeting-agent/
│
├── app/
│   ├── core/
│   │   |
│   │   ├── audio/
│   │   │   ├── extractor.py
│   │   │   └── cleaner.py
│   │   │
│   │   ├── transcription/
│   │   │   └── whisper_service.py
│   │   │
│   │   ├── llm/
│   │   │   ├── base.py
│   │   │   ├── factory.py
│   │   │   └── providers/
│   │   │       ├── openai_llm.py
│   │   │       └── ollama_llm.py
│   │   │
│   │   ├── ai/
│   │   │   ├── summarizer.py
│   │   │   └── event_extractor.py
│   │   │
│   │   ├── pipelines/
│   │   │   ├── state.py
│   │   │   ├── graph.py
│   │   │   └── nodes/
│   │   │       ├── extract_audio.py
│   │   │       ├── clean_audio.py
│   │   │       ├── transcribe.py
│   │   │       ├── summarize.py
│   │   │       └── extract_events.py
│   │   │
│   │   └── calendar/
│   │       └── mcp_client.py
│   │
│   ├── api/
│   │   └── routes/
│   │       └── process.py
│   │
│   └── main.py
│
├── inputs/
│   └── test_recording.mp4
│
├── outputs/
│   ├── transcript.txt
│   ├── summary.txt
│   └── events.json
│
├── .env
├── requirements.txt
└── README.md



```

---

### SOME NOTES


``` bash
 uvicorn main:app --host 0.0.0.0 --port 8000
```



