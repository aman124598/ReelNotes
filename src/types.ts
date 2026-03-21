export interface Note {
  id: number;
  owner_id?: string | null;
  url: string;
  title: string;
  content_type: string;
  structured_text: string;
  raw_transcript?: string;
  raw_ocr?: string;
  source_transcript?: string;
  processing_error?: string;
  recipe_json?: RecipeJson | null;
  status: 'queued' | 'processing' | 'ready' | 'failed';
  created_at: string;
  updated_at: string;
}

export type ContentType = 'Recipe' | 'Workout' | 'Travel' | 'Educational' | 'DIY' | 'Other' | 'Unspecified';

export interface RecipeIngredient {
  item: string;
  quantity: string | null;
  notes: string | null;
}

export interface RecipeStep {
  order: number;
  instruction: string;
  time: string | null;
  heat: string | null;
}

export interface RecipeJson {
  dish_name: string;
  servings: string | null;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  tips: string[];
  total_time: string | null;
  confidence: number;
  missing_info: string[];
}
