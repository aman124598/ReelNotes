export const normalizeText = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : fallback;
  }

  if (value === null || value === undefined) {
    return fallback;
  }

  if (Array.isArray(value)) {
    const lines = value
      .map((item) => normalizeText(item, ''))
      .filter((item) => item.length > 0);
    if (!lines.length) {
      return fallback;
    }
    return lines.map((line) => (line.startsWith('- ') ? line : `- ${line}`)).join('\n');
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

    const entries = Object.entries(record);
    if (!entries.length) {
      return fallback;
    }

    const blocks = entries
      .map(([key, val]) => {
        const formatted = normalizeText(val, '');
        if (!formatted) return '';
        return `${key}\n${formatted}`;
      })
      .filter(Boolean);

    return blocks.length ? blocks.join('\n\n') : fallback;
  }

  return String(value);
};

export const normalizeContentType = (value: unknown): string => {
  const text = normalizeText(value, 'Other').toLowerCase();
  if (text.includes('recipe')) return 'Recipe';
  if (text.includes('workout')) return 'Workout';
  if (text.includes('travel')) return 'Travel';
  if (text.includes('educational')) return 'Educational';
  if (text.includes('diy')) return 'DIY';
  return 'Other';
};
