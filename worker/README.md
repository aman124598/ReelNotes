# ReelNotes Worker (FastAPI)

This service processes queued Instagram reel jobs:
1. Claims one queued job atomically from Supabase.
2. Pulls captions with `yt-dlp`.
3. Extracts on-screen text via OCR from sampled video frames.
4. Combines captions + OCR text, then extracts structured recipe JSON.
5. Saves `recipe_json`, `source_transcript`, and `structured_text` back to `reels`.

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
- If `GROQ_API_KEY` is missing, the worker falls back to a local heuristic parser for recipe structuring.

## Troubleshooting

### Reel processing hangs or takes too long
**Symptoms**: Reel stays in "processing" status indefinitely or for hours.

**Solution**: Ensure these timeout environment variables are set in `.env`:
```env
DOWNLOAD_TIMEOUT_SECONDS=120     # Timeout for yt-dlp/ffmpeg operations
INFO_TIMEOUT_SECONDS=30          # Timeout for metadata extraction
MAX_DURATION_SECONDS=180         # Max reel duration allowed
```

If a reel times out, it will fail with an error like:
- `Command timeout: yt-dlp exceeded 120s timeout. Network issue or service blocked access.`

### Instagram blocks reel downloads
**Symptoms**: Error message includes "403 Forbidden", "401 Unauthorized", or "Instagram is blocking"

**Causes**:
- Instagram actively blocks automated scraping from `yt-dlp`
- The account or IP may be rate-limited or banned
- The reel may be private or from a restricted account

**Solutions**:
1. Use Instagram cookies to improve success rates:
   - Export `cookies.txt` from your browser
   - Set `YTDLP_COOKIES_FILE=/path/to/cookies.txt` in `.env`

2. Enable RapidAPI scraper (alternative method):
   - Sign up at https://rapidapi.com/Datapark6/api/instagram-downloader-v2-scraper-reels-igtv-posts-stories
   - Set `RAPID_API_KEY=your_key` in `.env`
   - This is used by the Supabase Edge Function `extract-reel`

3. Check Instagram's rate limits:
   - Wait 1-24 hours before retrying if rate-limited
   - Reels from blocked accounts may never be accessible

### OCR extraction is slow
**Solution**: Reduce processing load:
- `OCR_ENABLED=false` to skip OCR extraction
- `OCR_MAX_FRAMES=4` to sample fewer frames (default 8)

### Worker not processing jobs
**Check**:
```bash
curl http://localhost:8000/worker/diagnostics -H "Authorization: Bearer YOUR_WORKER_SECRET"
```

Verify:
- `"dependencies": {"yt-dlp": true, "ffmpeg": true}` - binaries installed?
- `"has_supabase_url": true` and `"has_supabase_key": true` - env vars set?
- `"auto_poll_started": true` - worker polling enabled?
- Check logs for error messages about API calls or database access
