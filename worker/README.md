# ReelNotes Worker (FastAPI)

This service processes queued Instagram reel jobs:
1. Claims one queued job atomically from Supabase.
2. Pulls captions with `yt-dlp`.
3. Falls back to audio transcription with `ffmpeg` + `faster-whisper`.
4. Extracts recipe JSON using Groq.
5. Saves `recipe_json`, `source_transcript`, and `structured_text` back to `reels`.

## Prerequisites

- Python 3.10+
- `yt-dlp` installed and available in PATH
- `ffmpeg` installed and available in PATH

## Setup

```bash
cd worker
python -m venv .venv
. .venv/Scripts/Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

## Run

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --env-file .env
```

## Trigger processing

Run a single job:

```bash
curl -X POST http://localhost:8000/worker/run-once -H "Authorization: Bearer YOUR_WORKER_SECRET"
```

Run loop (up to 20 jobs):

```bash
curl -X POST "http://localhost:8000/worker/run-loop?max_jobs=20&sleep_seconds=1" -H "Authorization: Bearer YOUR_WORKER_SECRET"
```

Check worker readiness and dependency status:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/worker/diagnostics -H "Authorization: Bearer YOUR_WORKER_SECRET"
```

Optional reliability boost for Instagram extraction:
- Export Instagram `cookies.txt` and set `YTDLP_COOKIES_FILE` in `.env`

Important:
- `SUPABASE_SERVICE_ROLE_KEY` must be your actual Supabase **service_role** key, not anon key.
