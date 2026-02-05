export interface Note {
  id: number;
  url: string;
  title: string;
  content_type: string;
  structured_text: string;
  raw_transcript?: string;
  raw_ocr?: string;
  status: 'draft' | 'ready';
  created_at: string;
  updated_at: string;
}

export type ContentType = 'Recipe' | 'Workout' | 'Travel' | 'Educational' | 'DIY' | 'Other' | 'Unspecified';
