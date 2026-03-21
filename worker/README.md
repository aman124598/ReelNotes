# ReelNotes Worker (FastAPI)

This service processes queued Instagram reel jobs:
1. Claims one queued job atomically from Supabase.
2. Pulls captions with `yt-dlp`.
3. Extracts on-screen text via OCR from sampled video frames.
4. Falls back to audio transcription with `ffmpeg` + `faster-whisper`.
5. Combines captions + OCR + transcript, then extracts structured recipe JSON.
6. Saves `recipe_json`, `source_transcript`, and `structured_text` back to `reels`.

## Prerequisites

- Python 3.10+
- `yt-dlp` installed and available in PATH
- `ffmpeg` installed and available in PATH
- `tesseract` installed and available in PATH (or set `TESSERACT_CMD`)

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

By default, the worker now auto-polls queued jobs in the background while running.
Configure with:
- `AUTO_POLL_ENABLED=true|false`
- `AUTO_POLL_INTERVAL_SECONDS=5`
- `AUTO_POLL_ERROR_BACKOFF_SECONDS=8`

Check worker readiness and dependency status:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/worker/diagnostics -H "Authorization: Bearer YOUR_WORKER_SECRET"
```

Optional reliability boost for Instagram extraction:
- Export Instagram `cookies.txt` and set `YTDLP_COOKIES_FILE` in `.env`

Important:
- `SUPABASE_SERVICE_ROLE_KEY` must be your actual Supabase **service_role** key, not anon key.

## OCR and parsing behavior

- `OCR_ENABLED=true` enables extraction of on-screen recipe text from video frames.
- `OCR_FRAME_INTERVAL_SECONDS` controls frame sampling rate.
- `OCR_MAX_FRAMES` limits processing cost per reel.
- `OCR_RECIPE_SIGNAL_THRESHOLD` controls how much recipe-like OCR text is needed before audio can be skipped.
- `FORCE_AUDIO_TRANSCRIBE=true` runs audio transcription even when captions exist.
- `PRIORITIZE_OCR_OVER_AUDIO=true` skips audio transcription when OCR strongly indicates recipe content.
- If `GROQ_API_KEY` is missing, the worker falls back to a local heuristic parser for recipe structuring.
