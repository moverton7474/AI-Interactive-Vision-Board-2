-- Migration: Add model_used and reference tracking to vision_boards
-- Date: 2024-12-11
-- Purpose: Support Nano Banana Pro likeness preservation tracking

-- Add model_used column to track which model generated the image
ALTER TABLE public.vision_boards
ADD COLUMN IF NOT EXISTS model_used TEXT;

-- Add reference_image_ids to track which references were used
ALTER TABLE public.vision_boards
ADD COLUMN IF NOT EXISTS reference_image_ids UUID[];

-- Add likeness metadata column for validation results
ALTER TABLE public.vision_boards
ADD COLUMN IF NOT EXISTS likeness_metadata JSONB DEFAULT '{}'::jsonb;

-- Add column for tracking if likeness optimization was used
ALTER TABLE public.vision_boards
ADD COLUMN IF NOT EXISTS likeness_optimized BOOLEAN DEFAULT FALSE;

-- Create index for querying by model used (analytics)
CREATE INDEX IF NOT EXISTS idx_vision_boards_model_used
ON public.vision_boards(model_used);

-- Create vision_board_diagnostics table for likeness validation audit trail
CREATE TABLE IF NOT EXISTS public.vision_board_diagnostics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vision_board_id UUID REFERENCES public.vision_boards(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    -- Generation metadata
    model_used TEXT,
    reference_image_count INTEGER DEFAULT 0,
    identity_prompt_length INTEGER DEFAULT 0,

    -- Likeness validation results
    likeness_score NUMERIC(3,2),
    face_match BOOLEAN,
    skin_tone_match BOOLEAN,
    age_match BOOLEAN,
    body_type_match BOOLEAN,
    overall_recognizable BOOLEAN,
    validation_explanation TEXT,
    validation_issues TEXT[],
    validation_suggestions TEXT[],

    -- Performance metrics
    generation_duration_ms INTEGER,
    validation_duration_ms INTEGER
);

-- Enable RLS on diagnostics table
ALTER TABLE public.vision_board_diagnostics ENABLE ROW LEVEL SECURITY;

-- Users can view their own diagnostics
CREATE POLICY "Users can view own diagnostics"
ON public.vision_board_diagnostics
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own diagnostics
CREATE POLICY "Users can insert own diagnostics"
ON public.vision_board_diagnostics
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for querying diagnostics by vision board
CREATE INDEX IF NOT EXISTS idx_diagnostics_vision_board
ON public.vision_board_diagnostics(vision_board_id);

-- Create index for querying diagnostics by user
CREATE INDEX IF NOT EXISTS idx_diagnostics_user
ON public.vision_board_diagnostics(user_id);

-- Comment on columns for documentation
COMMENT ON COLUMN public.vision_boards.model_used IS 'The Gemini model that generated this vision board (e.g., gemini-2.5-pro-preview-06-05)';
COMMENT ON COLUMN public.vision_boards.reference_image_ids IS 'Array of reference_images.id used for likeness preservation';
COMMENT ON COLUMN public.vision_boards.likeness_metadata IS 'JSON containing likeness validation results and scores';
COMMENT ON COLUMN public.vision_boards.likeness_optimized IS 'Whether Nano Banana Pro likeness optimization was used';

COMMENT ON TABLE public.vision_board_diagnostics IS 'Audit trail for vision board generation and likeness validation metrics';
