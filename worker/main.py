import json
import os
import re
import shutil
import subprocess
import tempfile
import time
import base64
import threading
from urllib.parse import quote
from typing import Any

import requests
import pytesseract
from fastapi import FastAPI, Header, HTTPException
from faster_whisper import WhisperModel
from dotenv import load_dotenv
from PIL import Image
from supabase import Client, create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "") or os.getenv("SUPABASE_ANON_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
WORKER_SECRET = os.getenv("WORKER_SECRET", "")
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
MAX_DURATION_SECONDS = int(os.getenv("MAX_DURATION_SECONDS", "180"))
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "small.en")
WHISPER_FALLBACK_MODEL_SIZE = os.getenv("WHISPER_FALLBACK_MODEL_SIZE", "tiny")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
YTDLP_COOKIES_FILE = os.getenv("YTDLP_COOKIES_FILE", "").strip()
OCR_ENABLED = os.getenv("OCR_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}
OCR_FRAME_INTERVAL_SECONDS = float(os.getenv("OCR_FRAME_INTERVAL_SECONDS", "1.5"))
OCR_MAX_FRAMES = int(os.getenv("OCR_MAX_FRAMES", "8"))
OCR_LANG = os.getenv("OCR_LANG", "eng")
OCR_MIN_LINE_LENGTH = int(os.getenv("OCR_MIN_LINE_LENGTH", "3"))
FORCE_AUDIO_TRANSCRIBE = os.getenv("FORCE_AUDIO_TRANSCRIBE", "false").strip().lower() in {"1", "true", "yes", "on"}
TESSERACT_CMD = os.getenv("TESSERACT_CMD", "").strip()
AUTO_POLL_ENABLED = os.getenv("AUTO_POLL_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}
AUTO_POLL_INTERVAL_SECONDS = float(os.getenv("AUTO_POLL_INTERVAL_SECONDS", "5"))
AUTO_POLL_ERROR_BACKOFF_SECONDS = float(os.getenv("AUTO_POLL_ERROR_BACKOFF_SECONDS", "8"))

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
  raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")

if not GROQ_API_KEY:
  print("[worker] Warning: GROQ_API_KEY is missing. Falling back to local heuristic recipe parsing.")

if TESSERACT_CMD:
  pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
app = FastAPI(title="ReelNotes Worker")
_whisper_model: WhisperModel | None = None
_auto_poll_thread: threading.Thread | None = None
_auto_poll_started = False


def _decode_jwt_role(token: str) -> str:
  try:
    parts = token.split(".")
    if len(parts) < 2:
      return "unknown"
    payload = parts[1] + "=" * (-len(parts[1]) % 4)
    decoded = json.loads(base64.urlsafe_b64decode(payload.encode("utf-8")).decode("utf-8"))
    return str(decoded.get("role") or "unknown")
  except Exception:
    return "unknown"


JWT_ROLE = _decode_jwt_role(SUPABASE_SERVICE_ROLE_KEY)
if JWT_ROLE != "service_role":
  print(
    "[worker] Warning: SUPABASE_SERVICE_ROLE_KEY is not a service_role token. "
    "Use service_role key for best reliability."
  )


def _require_secret(auth_header: str | None) -> None:
  if not WORKER_SECRET:
    return
  if not auth_header or auth_header.strip() != f"Bearer {WORKER_SECRET}":
    raise HTTPException(status_code=401, detail="Unauthorized")


def _load_whisper(model_size: str) -> WhisperModel:
  global _whisper_model
  if _whisper_model is None:
    _whisper_model = WhisperModel(model_size, device="cpu", compute_type="int8")
  return _whisper_model


def _run_cmd(command: list[str], cwd: str | None = None) -> str:
  try:
    result = subprocess.run(command, cwd=cwd, capture_output=True, text=True, check=False)
  except FileNotFoundError as error:
    binary = command[0] if command else "unknown"
    raise RuntimeError(
      f"Dependency missing: `{binary}` is not installed or not in PATH."
    ) from error

  if result.returncode != 0:
    stderr = (result.stderr or "").strip()
    stdout = (result.stdout or "").strip()
    details = stderr or stdout or "Unknown command error"
    raise RuntimeError(f"Command failed: {' '.join(command)}\n{details}")
  return result.stdout


def _trim_error(error_text: str, max_len: int = 900) -> str:
  text = (error_text or "").strip()
  if len(text) <= max_len:
    return text
  return text[:max_len] + "..."


def _ytdlp_prefix() -> list[str]:
  prefix = ["yt-dlp", "--no-warnings", "--no-playlist"]
  if YTDLP_COOKIES_FILE:
    prefix.extend(["--cookies", YTDLP_COOKIES_FILE])
  return prefix


def _extract_url_info(url: str) -> dict[str, Any]:
  output = _run_cmd([*_ytdlp_prefix(), "-J", url])
  return json.loads(output)


def _clean_vtt(text: str) -> str:
  lines = text.splitlines()
  cleaned = []
  for line in lines:
    stripped = line.strip()
    if not stripped:
      continue
    if stripped.startswith("WEBVTT"):
      continue
    if "-->" in stripped:
      continue
    if re.match(r"^\d+$", stripped):
      continue
    stripped = re.sub(r"<[^>]+>", "", stripped)
    cleaned.append(stripped)
  return "\n".join(cleaned).strip()


def _load_caption_text(temp_dir: str, url: str) -> str:
  try:
    _run_cmd([
      *_ytdlp_prefix(),
      "--skip-download",
      "--write-auto-subs",
      "--write-subs",
      "--sub-langs",
      "en.*",
      "--sub-format",
      "vtt",
      "-o",
      "%(id)s.%(ext)s",
      url,
    ], cwd=temp_dir)
  except Exception:
    # Caption extraction is optional; audio fallback should still run.
    return ""

  for name in os.listdir(temp_dir):
    if name.endswith(".vtt"):
      with open(os.path.join(temp_dir, name), "r", encoding="utf-8", errors="ignore") as file:
        cleaned = _clean_vtt(file.read())
        if cleaned:
          return cleaned
  return ""


def _download_audio(temp_dir: str, url: str) -> str:
  output_template = os.path.join(temp_dir, "audio.%(ext)s")
  _run_cmd([
    *_ytdlp_prefix(),
    "-f",
    "bestaudio/best",
    "-o",
    output_template,
    url,
  ], cwd=temp_dir)
  for name in os.listdir(temp_dir):
    if name.startswith("audio."):
      input_path = os.path.join(temp_dir, name)
      out_path = os.path.join(temp_dir, "audio.wav")
      _run_cmd([
        "ffmpeg",
        "-y",
        "-i",
        input_path,
        "-ac",
        "1",
        "-ar",
        "16000",
        out_path,
      ])
      return out_path
  raise RuntimeError("Audio file download failed")


def _download_video(temp_dir: str, url: str) -> str:
  output_template = os.path.join(temp_dir, "video.%(ext)s")
  _run_cmd([
    *_ytdlp_prefix(),
    "-f",
    "mp4/bestvideo+bestaudio/best",
    "-o",
    output_template,
    url,
  ], cwd=temp_dir)

  for name in os.listdir(temp_dir):
    if name.startswith("video."):
      return os.path.join(temp_dir, name)
  raise RuntimeError("Video file download failed")


def _extract_ocr_text(temp_dir: str, url: str) -> str:
  if not OCR_ENABLED:
    return ""

  if OCR_MAX_FRAMES <= 0:
    return ""

  video_path = _download_video(temp_dir, url)
  frame_pattern = os.path.join(temp_dir, "ocr_frame_%03d.jpg")
  fps = 1.0 / max(OCR_FRAME_INTERVAL_SECONDS, 0.2)
  _run_cmd([
    "ffmpeg",
    "-y",
    "-i",
    video_path,
    "-vf",
    f"fps={fps}",
    "-frames:v",
    str(OCR_MAX_FRAMES),
    frame_pattern,
  ])

  ocr_lines: list[str] = []
  seen = set()
  for name in sorted(os.listdir(temp_dir)):
    if not name.startswith("ocr_frame_") or not name.endswith(".jpg"):
      continue

    frame_path = os.path.join(temp_dir, name)
    try:
      text = pytesseract.image_to_string(Image.open(frame_path), lang=OCR_LANG)
    except Exception:
      continue

    for raw_line in text.splitlines():
      line = re.sub(r"\s+", " ", raw_line).strip()
      if len(line) < OCR_MIN_LINE_LENGTH:
        continue
      key = line.lower()
      if key in seen:
        continue
      seen.add(key)
      ocr_lines.append(line)

  return "\n".join(ocr_lines)


def _transcribe_audio(audio_path: str) -> str:
  try:
    model = _load_whisper(WHISPER_MODEL_SIZE)
    segments, _ = model.transcribe(audio_path, beam_size=3, language="en")
  except Exception:
    model = WhisperModel(WHISPER_FALLBACK_MODEL_SIZE, device="cpu", compute_type="int8")
    segments, _ = model.transcribe(audio_path, beam_size=2, language="en")

  transcript = " ".join(segment.text.strip() for segment in segments).strip()
  return transcript


def _merge_text(primary: str, secondary: str) -> str:
  merged = []
  seen = set()
  for block in [primary, secondary]:
    for raw_line in block.splitlines():
      line = re.sub(r"\s+", " ", raw_line).strip()
      if len(line) < 2:
        continue
      key = line.lower()
      if key in seen:
        continue
      seen.add(key)
      merged.append(line)
  return "\n".join(merged)


def _parse_json_from_model_response(content: str) -> dict[str, Any]:
  match = re.search(r"```json\s*(\{[\s\S]*\})\s*```", content)
  if match:
    return json.loads(match.group(1))
  brace_match = re.search(r"\{[\s\S]*\}", content)
  if brace_match:
    return json.loads(brace_match.group(0))
  return json.loads(content)


def _call_groq(prompt: str) -> str:
  if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY is not configured")

  last_error = "Unknown Groq error"
  for attempt in range(3):
    response = requests.post(
      "https://api.groq.com/openai/v1/chat/completions",
      headers={
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
      },
      json={
        "model": GROQ_MODEL,
        "temperature": 0.1,
        "max_tokens": 1800,
        "messages": [
          {"role": "system", "content": "You extract recipe data and output strict JSON only."},
          {"role": "user", "content": prompt},
        ],
      },
      timeout=60,
    )
    if response.status_code < 400:
      payload = response.json()
      return payload["choices"][0]["message"]["content"]

    last_error = f"Groq API error {response.status_code}: {response.text}"
    if response.status_code in (429, 500, 502, 503, 504) and attempt < 2:
      time.sleep(2 * (attempt + 1))
      continue
    break
  raise RuntimeError(last_error)


def _validate_recipe_schema(recipe: dict[str, Any]) -> dict[str, Any]:
  required = ["dish_name", "servings", "ingredients", "steps", "tips", "total_time", "confidence", "missing_info"]
  for key in required:
    if key not in recipe:
      raise ValueError(f"Missing recipe field: {key}")

  if not isinstance(recipe["ingredients"], list) or not isinstance(recipe["steps"], list):
    raise ValueError("ingredients and steps must be arrays")

  recipe["dish_name"] = str(recipe.get("dish_name") or "Untitled Recipe")
  recipe["servings"] = recipe.get("servings")
  recipe["tips"] = [str(tip) for tip in recipe.get("tips") or []]
  recipe["total_time"] = recipe.get("total_time")
  recipe["confidence"] = float(recipe.get("confidence") or 0.0)
  recipe["missing_info"] = [str(item) for item in recipe.get("missing_info") or []]

  normalized_ingredients = []
  for item in recipe["ingredients"]:
    normalized_ingredients.append({
      "item": str(item.get("item") or "").strip(),
      "quantity": item.get("quantity"),
      "notes": item.get("notes"),
    })
  recipe["ingredients"] = [i for i in normalized_ingredients if i["item"]]

  normalized_steps = []
  for idx, step in enumerate(recipe["steps"], start=1):
    instruction = str(step.get("instruction") or "").strip()
    if not instruction:
      continue
    normalized_steps.append({
      "order": int(step.get("order") or idx),
      "instruction": instruction,
      "time": step.get("time"),
      "heat": step.get("heat"),
    })
  recipe["steps"] = normalized_steps
  return recipe


def _extract_recipe_open_source(transcript: str) -> dict[str, Any]:
  lines = [re.sub(r"\s+", " ", line).strip() for line in transcript.splitlines()]
  lines = [line for line in lines if line]

  dish_name = _extract_title_from_text(transcript)
  ingredients: list[dict[str, Any]] = []
  steps: list[dict[str, Any]] = []

  in_ingredients = False
  in_steps = False

  ingredient_line_re = re.compile(r"^([\-\*•]|\d+[\.)]|\d+\s?(g|kg|ml|l|tbsp|tsp|cup|cups|oz|lb)\b)", re.IGNORECASE)
  step_line_re = re.compile(r"^(step\s*\d+[:.)-]?|\d+[\.)-])", re.IGNORECASE)

  for line in lines:
    lower = line.lower()

    if "ingredient" in lower:
      in_ingredients = True
      in_steps = False
      continue
    if "instruction" in lower or "method" in lower or "direction" in lower or "step" == lower:
      in_steps = True
      in_ingredients = False
      continue

    if in_ingredients or ingredient_line_re.match(line):
      cleaned = re.sub(r"^[\-\*•\d\.)\s]+", "", line).strip()
      if cleaned:
        ingredients.append({"item": cleaned, "quantity": None, "notes": None})
      continue

    if in_steps or step_line_re.match(line):
      cleaned = re.sub(r"^(step\s*\d+[:.)-]?|\d+[\.)-])\s*", "", line, flags=re.IGNORECASE).strip()
      if cleaned:
        steps.append({"order": len(steps) + 1, "instruction": cleaned, "time": None, "heat": None})

  if not steps:
    for sentence in re.split(r"(?<=[.!?])\s+", transcript):
      text = sentence.strip()
      if len(text) < 15:
        continue
      if len(steps) >= 8:
        break
      steps.append({"order": len(steps) + 1, "instruction": text, "time": None, "heat": None})

  if not ingredients and lines:
    fallback_ingredients = []
    for line in lines[:40]:
      if ingredient_line_re.match(line):
        cleaned = re.sub(r"^[\-\*•\d\.)\s]+", "", line).strip()
        if cleaned:
          fallback_ingredients.append({"item": cleaned, "quantity": None, "notes": None})
      if len(fallback_ingredients) >= 20:
        break
    ingredients = fallback_ingredients

  recipe = {
    "dish_name": dish_name,
    "servings": None,
    "ingredients": ingredients,
    "steps": steps,
    "tips": [],
    "total_time": None,
    "confidence": 0.45 if steps else 0.25,
    "missing_info": ["Parsed with local heuristic parser; review quantities and ordering."],
  }
  return _validate_recipe_schema(recipe)


def _extract_recipe(transcript: str) -> dict[str, Any]:
  if not GROQ_API_KEY:
    return _extract_recipe_open_source(transcript)

  base_prompt = f"""
Extract only the actionable food recipe from this Instagram reel transcript.
Ignore jokes, intros, sponsorships, and unrelated chatter.
Return JSON only with this exact schema:
{{
  "dish_name": "string",
  "servings": "string|null",
  "ingredients": [{{ "item": "string", "quantity": "string|null", "notes": "string|null" }}],
  "steps": [{{ "order": 1, "instruction": "string", "time": "string|null", "heat": "string|null" }}],
  "tips": ["string"],
  "total_time": "string|null",
  "confidence": 0.0,
  "missing_info": ["string"]
}}
If uncertain, set values to null and add detail in missing_info.
Transcript:
{transcript}
"""
  first = _call_groq(base_prompt)
  try:
    return _validate_recipe_schema(_parse_json_from_model_response(first))
  except Exception:
    repair_prompt = f"Repair this into valid JSON matching the required schema only:\n{first}"
    repaired = _call_groq(repair_prompt)
    return _validate_recipe_schema(_parse_json_from_model_response(repaired))


def _extract_title_from_text(text: str) -> str:
  for raw in text.splitlines():
    line = raw.strip()
    if len(line) >= 4:
      return line[:80]
  return "Reel Note"


def _fallback_recipe(transcript: str, reason: str) -> dict[str, Any]:
  return {
    "dish_name": _extract_title_from_text(transcript),
    "servings": None,
    "ingredients": [],
    "steps": [{"order": 1, "instruction": "Refer to transcript content below.", "time": None, "heat": None}],
    "tips": [],
    "total_time": None,
    "confidence": 0.25,
    "missing_info": [f"Recipe parser fallback used: {reason}"],
  }


def _recipe_to_structured_text(recipe: dict[str, Any]) -> str:
  lines = [f"Title: {recipe['dish_name']}", "Type: Recipe", ""]
  if recipe.get("servings"):
    lines.append(f"Servings: {recipe['servings']}")
  if recipe.get("total_time"):
    lines.append(f"Total Time: {recipe['total_time']}")
  lines.append("")
  lines.append("Ingredients:")
  if recipe["ingredients"]:
    for ingredient in recipe["ingredients"]:
      quantity = f"{ingredient['quantity']} " if ingredient.get("quantity") else ""
      notes = f" ({ingredient['notes']})" if ingredient.get("notes") else ""
      lines.append(f"- {quantity}{ingredient['item']}{notes}")
  else:
    lines.append("- Not clearly specified")
  lines.append("")
  lines.append("Instructions:")
  if recipe["steps"]:
    for idx, step in enumerate(sorted(recipe["steps"], key=lambda s: s["order"]), start=1):
      extra_parts = []
      if step.get("time"):
        extra_parts.append(f"time: {step['time']}")
      if step.get("heat"):
        extra_parts.append(f"heat: {step['heat']}")
      extra = f" ({', '.join(extra_parts)})" if extra_parts else ""
      lines.append(f"{idx}. {step['instruction']}{extra}")
  else:
    lines.append("1. Instructions were not clearly stated in the reel.")
  if recipe.get("tips"):
    lines.append("")
    lines.append("Tips:")
    for tip in recipe["tips"]:
      lines.append(f"- {tip}")
  if recipe.get("missing_info"):
    lines.append("")
    lines.append("Missing Info:")
    for item in recipe["missing_info"]:
      lines.append(f"- {item}")
  return "\n".join(lines).strip()


def _mark_failed(job_id: int, reel_id: int, error_text: str) -> None:
  safe_error = _trim_error(error_text)
  attempts = 1
  try:
    job = supabase.table("reel_jobs").select("attempt_count").eq("id", job_id).single().execute()
    attempts = int(job.data.get("attempt_count", 1)) if job.data else 1
  except Exception as lookup_error:
    print(f"[worker] Failed to read attempt_count for job {job_id}: {lookup_error}")

  retryable = attempts < MAX_RETRIES

  try:
    supabase.table("reel_jobs").update({
      "status": "queued" if retryable else "failed",
      "last_error": safe_error,
    }).eq("id", job_id).execute()
  except Exception as job_update_error:
    print(f"[worker] Failed to update reel_jobs for job {job_id}: {job_update_error}")

  try:
    supabase.table("reels").update({
      "status": "queued" if retryable else "failed",
      "processing_error": safe_error,
    }).eq("id", reel_id).execute()
  except Exception as reel_update_error:
    print(f"[worker] Failed to update reels for reel {reel_id}: {reel_update_error}")


def _claim_next_job() -> dict[str, Any] | None:
  # Preferred path: server-side atomic claim.
  try:
    claim = supabase.rpc("claim_reel_job").execute()
    if claim.data:
      row = claim.data[0]
      return {
        "job_id": int(row["job_id"]),
        "reel_id": int(row["reel_id"]),
        "reel_url": str(row["reel_url"]),
        "attempt_count": int(row.get("attempt_count") or 1),
      }
    return None
  except Exception as rpc_error:
    print(f"[worker] claim_reel_job RPC unavailable, falling back to table claim: {rpc_error}")

  # Fallback path: optimistic client-side claim for environments where RPC permissions are blocked.
  for _ in range(5):
    candidates = supabase.table("reel_jobs") \
      .select("id, reel_id, attempt_count") \
      .eq("status", "queued") \
      .order("created_at") \
      .limit(1) \
      .execute()

    if not candidates.data:
      return None

    candidate = candidates.data[0]
    job_id = int(candidate["id"])
    reel_id = int(candidate["reel_id"])
    attempt_count = int(candidate.get("attempt_count") or 0)

    supabase.table("reel_jobs").update({
      "status": "processing",
      "attempt_count": attempt_count + 1,
      "last_error": None,
    }).eq("id", job_id).eq("status", "queued").execute()

    verify_claim = supabase.table("reel_jobs").select("id, status, attempt_count").eq("id", job_id).single().execute()
    row = verify_claim.data or {}
    if row.get("status") != "processing":
      continue

    reel_row = supabase.table("reels").select("url").eq("id", reel_id).single().execute()
    reel_url = str((reel_row.data or {}).get("url") or "").strip()
    if not reel_url:
      raise RuntimeError(f"Reel URL missing for reel_id={reel_id}")

    supabase.table("reels").update({
      "status": "processing",
      "processing_error": None,
    }).eq("id", reel_id).execute()

    return {
      "job_id": job_id,
      "reel_id": reel_id,
      "reel_url": reel_url,
      "attempt_count": attempt_count + 1,
    }

  return None


def _oembed_caption(url: str) -> str:
  try:
    encoded = quote(url, safe="")
    response = requests.get(f"https://api.instagram.com/oembed/?url={encoded}", timeout=15)
    if response.status_code >= 400:
      return ""
    data = response.json()
    return str(data.get("title") or "").strip()
  except Exception:
    return ""


def _process_one_job() -> dict[str, Any]:
  try:
    claimed_job = _claim_next_job()
  except Exception as claim_error:
    return {"status": "failed", "error": f"Failed to claim queued job: {_trim_error(str(claim_error), 600)}"}

  if not claimed_job:
    return {"status": "idle"}

  job_id = int(claimed_job["job_id"])
  reel_id = int(claimed_job["reel_id"])
  reel_url = str(claimed_job["reel_url"])

  try:
    deps = _dependency_status()
    if not deps["yt-dlp"]:
      raise RuntimeError("Missing required dependency: yt-dlp is not installed or not in PATH")

    try:
      info = _extract_url_info(reel_url)
      duration = int(info.get("duration") or 0)
      if duration and duration > MAX_DURATION_SECONDS:
        raise RuntimeError(f"Reel exceeds max duration of {MAX_DURATION_SECONDS} seconds")
    except RuntimeError as info_error:
      # Continue; in some environments metadata read fails while download still works.
      print(f"[worker] Metadata read warning for reel {reel_id}: {info_error}")

    with tempfile.TemporaryDirectory() as temp_dir:
      captions = _load_caption_text(temp_dir, reel_url)
      ocr_text = ""
      transcript = ""

      if OCR_ENABLED:
        try:
          ocr_text = _extract_ocr_text(temp_dir, reel_url)
        except Exception as ocr_error:
          print(f"[worker] OCR extraction failed for reel {reel_id}: {ocr_error}")

      if FORCE_AUDIO_TRANSCRIBE or not captions:
        try:
          audio_path = _download_audio(temp_dir, reel_url)
          transcript = _transcribe_audio(audio_path)
        except Exception as audio_error:
          print(f"[worker] Audio extraction failed for reel {reel_id}: {audio_error}")

      combined = _merge_text(_merge_text(captions, ocr_text), transcript)
      if not combined:
        combined = _oembed_caption(reel_url)
      if not combined:
        raise RuntimeError("No captions or transcribable speech found")

      try:
        recipe = _extract_recipe(combined)
      except Exception as recipe_error:
        recipe = _fallback_recipe(combined, str(recipe_error))

      structured_text = _recipe_to_structured_text(recipe)
      if recipe.get("confidence", 0) <= 0.3 and combined:
        structured_text = f"{structured_text}\n\nTranscript:\n{combined[:4000]}"

      supabase.table("reels").update({
        "title": recipe.get("dish_name") or "Untitled Recipe",
        "content_type": "Recipe",
        "structured_text": structured_text,
        "raw_transcript": transcript,
        "raw_ocr": ocr_text,
        "source_transcript": combined,
        "recipe_json": recipe,
        "status": "ready",
        "processing_error": None,
      }).eq("id", reel_id).execute()

      supabase.table("reel_jobs").update({
        "status": "done",
        "last_error": None,
      }).eq("id", job_id).execute()

    return {"status": "processed", "reelId": reel_id, "jobId": job_id}
  except Exception as error:
    message = _trim_error(str(error))
    _mark_failed(job_id, reel_id, message)
    return {"status": "failed", "reelId": reel_id, "jobId": job_id, "error": message}


def _dependency_status() -> dict[str, bool]:
  tesseract_available = bool(TESSERACT_CMD) or shutil.which("tesseract") is not None
  return {
    "yt-dlp": shutil.which("yt-dlp") is not None,
    "ffmpeg": shutil.which("ffmpeg") is not None,
    "tesseract": tesseract_available,
    "cookies_file": bool(YTDLP_COOKIES_FILE),
  }

def _auto_poll_loop() -> None:
  while True:
    try:
      result = _process_one_job()
      if result.get("status") == "idle":
        time.sleep(max(0.5, AUTO_POLL_INTERVAL_SECONDS))
      else:
        # When work is found, keep draining the queue quickly.
        time.sleep(0.25)
    except Exception as poll_error:
      print(f"[worker] auto poll loop error: {poll_error}")
      time.sleep(max(1.0, AUTO_POLL_ERROR_BACKOFF_SECONDS))


@app.on_event("startup")
def start_auto_poll_worker() -> None:
  global _auto_poll_thread, _auto_poll_started
  if not AUTO_POLL_ENABLED or _auto_poll_started:
    return
  _auto_poll_started = True
  _auto_poll_thread = threading.Thread(target=_auto_poll_loop, name="reelnotes-auto-poll", daemon=True)
  _auto_poll_thread.start()
  print(
    f"[worker] Auto polling enabled (idle interval={AUTO_POLL_INTERVAL_SECONDS}s, "
    f"error backoff={AUTO_POLL_ERROR_BACKOFF_SECONDS}s)"
  )


@app.get("/health")
def health() -> dict[str, str]:
  return {"ok": "true"}


@app.get("/worker/diagnostics")
def diagnostics(authorization: str | None = Header(default=None)) -> dict[str, Any]:
  _require_secret(authorization)
  return {
    "dependencies": _dependency_status(),
    "has_supabase_url": bool(SUPABASE_URL),
    "has_supabase_key": bool(SUPABASE_SERVICE_ROLE_KEY),
    "supabase_jwt_role": JWT_ROLE,
    "has_groq_key": bool(GROQ_API_KEY),
    "max_retries": MAX_RETRIES,
    "max_duration_seconds": MAX_DURATION_SECONDS,
    "whisper_model": WHISPER_MODEL_SIZE,
    "groq_model": GROQ_MODEL,
    "ocr_enabled": OCR_ENABLED,
    "ocr_frame_interval_seconds": OCR_FRAME_INTERVAL_SECONDS,
    "ocr_max_frames": OCR_MAX_FRAMES,
    "ocr_lang": OCR_LANG,
    "force_audio_transcribe": FORCE_AUDIO_TRANSCRIBE,
    "has_tesseract_cmd_override": bool(TESSERACT_CMD),
    "yt_dlp_cookies_file": YTDLP_COOKIES_FILE or None,
    "auto_poll_enabled": AUTO_POLL_ENABLED,
    "auto_poll_started": _auto_poll_started,
    "auto_poll_interval_seconds": AUTO_POLL_INTERVAL_SECONDS,
  }


@app.post("/worker/run-once")
def run_once(authorization: str | None = Header(default=None)) -> dict[str, Any]:
  _require_secret(authorization)
  return _process_one_job()


@app.post("/worker/run-loop")
def run_loop(authorization: str | None = Header(default=None), max_jobs: int = 20, sleep_seconds: int = 2) -> dict[str, Any]:
  _require_secret(authorization)
  processed: list[dict[str, Any]] = []
  for _ in range(max_jobs):
    result = _process_one_job()
    if result["status"] == "idle":
      break
    processed.append(result)
    time.sleep(max(0, sleep_seconds))
  return {"count": len(processed), "results": processed}
