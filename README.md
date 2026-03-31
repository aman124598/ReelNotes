# ReelNotes

Turn Instagram reels into structured, searchable notes.

## Features

- Async reel queueing with Supabase Edge Functions and worker processing
- AI-assisted note formatting with Groq
- Local-first note storage on device (AsyncStorage)
- Manual Refresh button to sync latest server notes into local cache
- Local delete/edit support even when network or auth is unstable
- Search, pagination, retry processing, and note detail editing

## Local-first Behavior

- The app reads notes from local device storage by default.
- Notes persist across app restarts.
- Manual refresh syncs server data into local cache.
- If server operations fail, local changes are preserved.

## Prerequisites

- Node.js 18+
- Expo CLI tooling (`npx expo ...`)
- Supabase project
- Groq API key
- Python 3.10+ for worker (plus ffmpeg and yt-dlp)

## Quick Start

### 1. Install dependencies

```bash
git clone <your-repo-url>
cd ReelNotes
npm install
```

### 2. App environment

Create `.env` in project root:

```env
EXPO_PUBLIC_GROQ_API_KEY=gsk_your_groq_key_here
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=your_supabase_anon_key
```

### 3. Database schema

Run `supabase/schema.sql` in your Supabase SQL editor.

### 4. Supabase functions

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy enqueue-reel
npx supabase functions deploy get-reel-status
npx supabase functions deploy extract-reel
```

Set required function secrets:

```bash
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
npx supabase secrets set SUPABASE_ANON_KEY=your_supabase_anon_key
npx supabase secrets set RAPID_API_KEY=your_rapid_api_key
npx supabase secrets set WORKER_BASE_URL=https://your-worker-host
npx supabase secrets set WORKER_SECRET=your_worker_secret
```

### 5. Worker environment

Create `worker/.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GROQ_API_KEY=gsk_your_groq_key_here
WORKER_SECRET=your_worker_secret
```

### 6. Run app

```bash
npx expo start
```

## Common Commands

```bash
# Web
npx expo start --web

# Android
npx expo run:android

# iOS
npx expo run:ios

# Production build (EAS)
eas build --platform android --profile production
eas build --platform ios --profile production
```

## Project Structure

```text
ReelNotes/
├── src/
│   ├── components/
│   ├── screens/
│   ├── services/
│   ├── context/
│   ├── theme.ts
│   └── types.ts
├── supabase/
│   ├── functions/
│   ├── schema.sql
│   └── config.toml
├── worker/
│   ├── main.py
│   └── requirements.txt
├── App.js
├── index.js
└── app.json
```

## Troubleshooting

### Invalid JWT / 401 on functions

- Ensure anonymous auth is enabled in Supabase Auth settings.
- Verify app uses anon key (`EXPO_PUBLIC_SUPABASE_KEY`), not service role.
- Restart app with cache clear: `npx expo start --clear`.

### Notes not updating from server

- Tap Refresh on Home screen to sync.
- Check function logs in Supabase dashboard.

### Worker does not process queued jobs

- Confirm `WORKER_BASE_URL` and `WORKER_SECRET` secrets are set.
- Check worker logs and Supabase function logs.

## Security Notes

- Do not commit `.env`, `supabase/.env.local`, or `worker/.env`.
- Rotate secrets immediately if exposed.

## License

MIT
