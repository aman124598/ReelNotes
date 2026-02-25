# Supabase Edge Functions

## Quick Deploy

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF

cd supabase
supabase functions deploy enqueue-reel
supabase functions deploy get-reel-status

# Required for edge functions to write to DB directly
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## `enqueue-reel`

Queues a new reel job or retries an existing note.

### Request

```json
{ "url": "https://www.instagram.com/reel/ABC123/" }
```

Retry format:

```json
{ "reelId": 123, "retry": true }
```

### Response

```json
{ "reelId": 123, "status": "queued" }
```

## `get-reel-status`

Fetches latest reel note fields for polling.

### Request

```json
{ "reelId": 123 }
```

### Response

```json
{
  "reel": {
    "id": 123,
    "status": "processing",
    "processing_error": null
  }
}
```
