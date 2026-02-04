# Supabase Edge Function Deployment

## Quick Deploy

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref ynvnggcpchoarqsbyopd

# Deploy function
cd supabase/functions
supabase functions deploy extract-reel

# Set RapidAPI key (optional but recommended)
supabase secrets set RAPID_API_KEY=your_rapidapi_key_here
```

## Testing the Function

```bash
# Test locally
supabase functions serve extract-reel

# Test deployed function
curl -X POST \
  https://ynvnggcpchoarqsbyopd.supabase.co/functions/v1/extract-reel \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.instagram.com/reel/ABC123/"}'
```

## Get RapidAPI Key

1. Go to https://rapidapi.com/
2. Sign up/Login
3. Subscribe to Instagram Scraper API: https://rapidapi.com/restyler/api/instagram-scraper-api2
4. Copy your RapidAPI key from the API dashboard
5. Set in Supabase: `supabase secrets set RAPID_API_KEY=your_key`

## Function Environment Variables

- `RAPID_API_KEY` (optional): For better extraction quality

## Function Response

```json
{
  "transcript": "Video caption/transcript text",
  "ocr": "On-screen text extracted"
}
```

## Troubleshooting

- Check logs: `supabase functions logs extract-reel`
- Test URL format: Must be valid Instagram reel/post URL
- Verify secrets: `supabase secrets list`
