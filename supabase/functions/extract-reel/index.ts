import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ExtractRequest {
  url: string
}

interface ExtractResponse {
  transcript?: string
  ocr?: string
  error?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url }: ExtractRequest = await req.json()

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'Missing URL parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract Instagram reel ID from various URL formats
    const reelId = extractReelId(url)
    if (!reelId) {
      return new Response(
        JSON.stringify({ error: 'Invalid Instagram reel URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // For now, we'll use Instagram's oembed API to get basic info
    // In production, you'd use a service like RapidAPI's Instagram scraper
    // or implement your own scraper with proper authentication

    // Option 1: Use RapidAPI Instagram Scraper (recommended)
    const rapidApiKey = Deno.env.get('RAPID_API_KEY')

    let transcript = ''
    let ocr = ''

    if (rapidApiKey) {
      // Using Instagram Downloader V2 - Scraper - Reels IGTV Posts Stories
      try {
        console.log(`Calling Instagram Downloader V2 for URL: ${url}`);

        const encodedUrl = encodeURIComponent(url);
        const response = await fetch(
          `https://instagram-downloader-v2-scraper-reels-igtv-posts-stories.p.rapidapi.com/get-post?url=${encodedUrl}`,
          {
            method: 'GET',
            headers: {
              'x-rapidapi-key': rapidApiKey,
              'x-rapidapi-host': 'instagram-downloader-v2-scraper-reels-igtv-posts-stories.p.rapidapi.com'
            }
          }
        );

        console.log(`Response status: ${response.status}`);

        if (response.ok) {
          const responseText = await response.text();
          console.log('RapidAPI Raw Response:', responseText.substring(0, 1500));

          if (!responseText.trim().startsWith('<')) {
            try {
              const data = JSON.parse(responseText);
              console.log('Parsed response keys:', Object.keys(data));

              // Instagram Downloader V2 returns: { media: [{ caption, url, thumb, is_video }], owner: { username } }
              // Extract caption from media array first (this API's format)
              if (data?.media?.[0]?.caption) {
                transcript = data.media[0].caption;
                console.log('Found caption in media[0].caption');
              }
              // Fallback to other possible fields
              else if (data?.caption) {
                transcript = typeof data.caption === 'string' ? data.caption : data.caption?.text || '';
              } else if (data?.description) {
                transcript = data.description;
              } else if (data?.title) {
                transcript = data.title;
              } else if (data?.text) {
                transcript = data.text;
              } else if (data?.edge_media_to_caption?.edges?.[0]?.node?.text) {
                transcript = data.edge_media_to_caption.edges[0].node.text;
              } else if (data?.items?.[0]?.caption?.text) {
                transcript = data.items[0].caption.text;
              } else if (data?.graphql?.shortcode_media?.edge_media_to_caption?.edges?.[0]?.node?.text) {
                transcript = data.graphql.shortcode_media.edge_media_to_caption.edges[0].node.text;
              }

              // Extract OCR/accessibility text
              if (data?.accessibility_caption) {
                ocr = data.accessibility_caption;
              } else if (data?.alt_text) {
                ocr = data.alt_text;
              }

              if (transcript) {
                console.log('Successfully extracted caption:', transcript.substring(0, 100));
              } else {
                console.log('No caption found in response. Full data:', JSON.stringify(data, null, 2).substring(0, 2000));
              }
            } catch (parseErr) {
              console.error('Failed to parse response as JSON:', parseErr);
            }
          } else {
            console.error('Received HTML instead of JSON');
          }
        } else {
          const errorText = await response.text();
          console.error('RapidAPI Error:', response.status, errorText);
        }
      } catch (err) {
        console.error('RapidAPI request failed:', err);
      }
    }

    if (!transcript && !ocr) {
      // Fallback: Use Instagram's public oembed endpoint (limited data)
      try {
        console.log('Trying Instagram oembed fallback...');
        const response = await fetch(
          `https://api.instagram.com/oembed/?url=https://www.instagram.com/reel/${reelId}/`
        )

        if (response.ok) {
          const responseText = await response.text();
          if (!responseText.trim().startsWith('<')) {
            try {
              const data = JSON.parse(responseText);
              if (data.title) {
                transcript = data.title;
                console.log('Got caption from oembed');
              }
            } catch (parseErr) {
              console.error('Failed to parse oembed response:', parseErr);
            }
          }
        }
      } catch (oembedErr) {
        console.error('Oembed request failed:', oembedErr);
      }
    }

    const result: ExtractResponse = {
      transcript: transcript || undefined,
      ocr: ocr || undefined
    }

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || 'Extraction failed' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

function extractReelId(url: string): string | null {
  // Handle various Instagram URL formats:
  // https://www.instagram.com/reel/ABC123/
  // https://instagram.com/reel/ABC123
  // https://www.instagram.com/p/ABC123/

  const patterns = [
    /instagram\.com\/reel\/([A-Za-z0-9_-]+)/,
    /instagram\.com\/p\/([A-Za-z0-9_-]+)/,
    /instagram\.com\/tv\/([A-Za-z0-9_-]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}
