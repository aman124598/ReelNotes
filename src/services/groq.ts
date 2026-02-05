const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const normalizeText = (value: unknown, fallback: string): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : fallback;
  }

  if (value === null || value === undefined) {
    return fallback;
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => normalizeText(item, ''))
      .filter((item) => item.length > 0);
    return parts.length ? parts.join('\n\n') : fallback;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (record.section || record.content) {
      const section = normalizeText(record.section, '');
      const content = normalizeText(record.content, '');
      const combined = [section, content].filter(Boolean).join('\n');
      return combined.length ? combined : fallback;
    }

    if (Array.isArray(record.sections)) {
      return normalizeText(record.sections, fallback);
    }

    try {
      return JSON.stringify(record, null, 2);
    } catch (err) {
      return fallback;
    }
  }

  return String(value);
};

const normalizeContentType = (value: unknown): string => {
  const text = normalizeText(value, 'Other').toLowerCase();
  if (text.includes('recipe')) return 'Recipe';
  if (text.includes('workout')) return 'Workout';
  if (text.includes('travel')) return 'Travel';
  if (text.includes('educational')) return 'Educational';
  if (text.includes('diy')) return 'DIY';
  return 'Other';
};

export const formatWithGroq = async (transcript: string): Promise<{ title: string; contentType: string; structuredText: string }> => {
  try {
    const prompt = `You are a note-formatting AI. Format the following Instagram reel caption into a clean, organized note.

Rules:
1. Extract a short title (max 50 chars)
2. Detect content type: Recipe, Workout, Travel, Educational, DIY, or Other
3. Format with sections, bullet points, and emojis
4. If it's a recipe, structure as: Title, Type, Ingredients (bullet points), Instructions (numbered)
5. If it's a workout, structure as: Title, Type, Exercises (with sets/reps)
6. Keep it concise and readable

Caption:
${transcript}

Respond ONLY with valid JSON in this format:
{
  "title": "Short title here",
  "contentType": "Recipe|Workout|Travel|Educational|DIY|Other",
  "structuredText": "Formatted text with sections and emojis"
}`;

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are a helpful note-formatting assistant. Always respond with valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;

    const result = JSON.parse(jsonStr);

    const title = normalizeText(result.title, 'Untitled Note');
    const contentType = normalizeContentType(result.contentType);
    const structuredText = normalizeText(
      result.structuredText ?? result.sections ?? result.content ?? result,
      transcript
    );

    return {
      title,
      contentType,
      structuredText,
    };
  } catch (err: any) {
    console.error('Groq formatting error:', err);
    // Fallback formatting
    return {
      title: normalizeText(transcript.split('\n')[0].substring(0, 50), 'Untitled Note'),
      contentType: 'Other',
      structuredText: normalizeText(transcript, ''),
    };
  }
};
