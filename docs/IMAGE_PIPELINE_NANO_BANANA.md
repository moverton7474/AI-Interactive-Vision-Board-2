# Vision AI Image Pipeline - Nano Banana Pro Integration

## Overview

This document describes the upgraded image generation pipeline that uses Google's Nano Banana / Nano Banana Pro models (Gemini 2.5 Flash/Pro with native image generation) for superior likeness preservation in vision board generation.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           VisionBoard.tsx (Frontend)                        │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────────────────┐  │
│  │  Base Image  │  │ Reference Library │  │  Identity Descriptions       │  │
│  │  (User Photo)│  │ (Tagged Headshots)│  │  (Physical Characteristics)  │  │
│  └──────┬───────┘  └────────┬──────────┘  └──────────────┬──────────────┘  │
│         │                   │                            │                  │
│         └───────────────────┼────────────────────────────┘                  │
│                             │                                               │
│                    ┌────────▼────────┐                                      │
│                    │ editVisionImage │                                      │
│                    │ (geminiService) │                                      │
│                    └────────┬────────┘                                      │
└─────────────────────────────┼───────────────────────────────────────────────┘
                              │
                              │ POST /gemini-proxy
                              │ action: 'generate_image'
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Supabase Edge Function: gemini-proxy                     │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              buildLikenessPreservingRequest()                        │   │
│  │                                                                      │   │
│  │  Turn 1: Base Image + Critical Likeness Requirements                 │   │
│  │  Turn 2-N: Reference Images + Identity Descriptions                  │   │
│  │  Final Turn: Scene Generation + Style + Quality Modifiers            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Model Fallback Chain                              │   │
│  │                                                                      │   │
│  │  1. Nano Banana Pro (gemini-2.5-pro-preview-06-05)  ← Primary       │   │
│  │  2. Nano Banana (gemini-2.5-flash-preview-05-20)    ← Fallback 1    │   │
│  │  3. Gemini 2.0 Flash Exp                            ← Fallback 2    │   │
│  │  4. Imagen 3 (text-only, no reference support)      ← Last Resort   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                  Response: { image, model_used,                      │   │
│  │                              likeness_optimized, warning }           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ (Optional) action: 'validate_likeness'
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Likeness Validation (Background)                       │
│                                                                             │
│  Compares reference images with generated output                            │
│  Returns: likeness_score (0-1), face_match, body_type_match, etc.          │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Model Configuration

### Environment Variables

Configure model selection via Supabase Edge Function secrets:

```bash
# Primary model (Nano Banana Pro - best likeness)
GOOGLE_IMAGE_MODEL_PRIMARY=gemini-2.5-pro-preview-06-05

# Fallback model (Nano Banana - good balance)
GOOGLE_IMAGE_MODEL_FALLBACK=gemini-2.5-flash-preview-05-20
```

### Default Models (if env vars not set)

| Priority | Model ID | Description | Best For |
|----------|----------|-------------|----------|
| Primary | `gemini-2.5-pro-preview-06-05` | Nano Banana Pro | Character consistency, likeness preservation |
| Fallback 1 | `gemini-2.5-flash-preview-05-20` | Nano Banana | Faster generation, good likeness |
| Fallback 2 | `gemini-2.0-flash-exp` | Gemini 2.0 Exp | Stable, older model |
| Fallback 3 | `imagen-3.0-generate-002` | Imagen 3 | Text-only (no reference support) |

## Multi-Turn Conversation Structure

The key to better likeness preservation is using a multi-turn conversation structure instead of a single prompt:

### Turn 1: Base Image (Primary Reference)
```typescript
{
  role: 'user',
  parts: [
    { inlineData: { mimeType: 'image/jpeg', data: baseImageBase64 } },
    { text: `IMPORTANT: This is the primary reference photo...

      CRITICAL LIKENESS REQUIREMENTS:
      - Preserve exact facial features, face shape, and distinctive characteristics
      - Maintain accurate skin tone, complexion, and any visible marks/features
      - Keep the same approximate age appearance
      - Preserve body type and proportions
      ...` }
  ]
}
```

### Turn 2-N: Additional Reference Images
```typescript
{
  role: 'user',
  parts: [
    { inlineData: { mimeType: 'image/jpeg', data: refImageBase64 } },
    { text: `Additional reference photo of "Milton". Use this image to improve
             facial and body-type accuracy for this person.

             Physical description for Milton: tall Black male, 50s, athletic, glasses` }
  ]
}
```

### Final Turn: Scene Generation Instructions
```typescript
{
  role: 'user',
  parts: [{
    text: `Now generate a photorealistic vision board image with the following scene:

           ${sceneDescription}

           STRICT GENERATION RULES (in priority order):
           1. LIKENESS PRESERVATION (HIGHEST PRIORITY)
           2. SCENE INTEGRATION
           3. TEXT RENDERING (if title/embedded text provided)
           4. ARTISTIC STYLE
           5. PREMIUM QUALITY ENHANCEMENTS (for PRO/ELITE users)`
  }]
}
```

## Likeness Validation

### Enabling Validation

Likeness validation runs automatically in the background when:
1. Reference images are used
2. Generation completes successfully with `likeness_optimized: true`

### Validation Endpoint

```typescript
// Direct API call
const result = await supabase.functions.invoke('gemini-proxy', {
  body: {
    action: 'validate_likeness',
    referenceImages: ['base64...', 'base64...'],
    generatedImage: 'base64...',
    referenceDescriptions: ['Milton: tall Black male, 50s', 'Lisa: ...']
  }
});

// Result
{
  validation: {
    likeness_score: 0.85,
    face_match: true,
    skin_tone_match: true,
    age_match: true,
    body_type_match: true,
    overall_recognizable: true,
    explanation: "The generated image maintains good facial similarity...",
    issues: [],
    suggestions: []
  }
}
```

### Score Interpretation

| Score Range | Meaning | User Feedback |
|-------------|---------|---------------|
| 0.7 - 1.0 | Good likeness | Success (no alert) |
| 0.5 - 0.7 | Moderate likeness | "Likeness could be improved. Try regenerating." |
| 0.0 - 0.5 | Poor likeness | "Low likeness score. Consider regenerating with 'stronger likeness emphasis'." |

## Database Schema

### vision_boards Table (Extended)

```sql
ALTER TABLE vision_boards ADD COLUMN model_used TEXT;
ALTER TABLE vision_boards ADD COLUMN reference_image_ids UUID[];
ALTER TABLE vision_boards ADD COLUMN likeness_metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE vision_boards ADD COLUMN likeness_optimized BOOLEAN DEFAULT FALSE;
```

### vision_board_diagnostics Table

```sql
CREATE TABLE vision_board_diagnostics (
    id UUID PRIMARY KEY,
    vision_board_id UUID REFERENCES vision_boards(id),
    user_id UUID REFERENCES auth.users(id),
    model_used TEXT,
    reference_image_count INTEGER,
    identity_prompt_length INTEGER,
    likeness_score NUMERIC(3,2),
    face_match BOOLEAN,
    body_type_match BOOLEAN,
    generation_duration_ms INTEGER,
    validation_duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE
);
```

## Testing

### Run Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- --grep "likeness"
```

### Dev Harness

A development page is available for testing the likeness pipeline:

1. Navigate to `/dev/likeness-test` (if enabled in development mode)
2. Select a user, base image, and reference images
3. Click "Generate" to test the full pipeline
4. View:
   - Prompt text sent (sanitized)
   - Model used and latency
   - Generated image thumbnail
   - Likeness validation results

### Manual Testing Steps

1. **Upload Reference Images**
   - Go to Visualize page
   - In Reference Library sidebar, upload headshots
   - Add identity descriptions (e.g., "tall Black male, 50s, athletic, glasses")

2. **Generate Vision Board**
   - Upload a base image
   - Select reference images from library
   - Enter scene description
   - Click "Generate Vision"

3. **Verify Results**
   - Check "Likeness Optimized" badge appears
   - Wait for likeness score (runs in background)
   - Score >= 0.7 indicates good likeness preservation

## Troubleshooting

### Model Not Available

If you see "Model returned text instead of image" errors:

1. Run diagnostics: `action: 'diagnose'`
2. Check API key permissions in Google AI Studio
3. Try a different model by setting environment variables

### Low Likeness Scores

If generated images don't match reference photos:

1. Add more detailed identity descriptions
2. Use multiple reference images from different angles
3. Ensure reference photos are clear, well-lit headshots
4. Try regenerating - likeness can vary between generations

### API Rate Limits

If you hit rate limits:

1. The system automatically retries with exponential backoff
2. Falls back to alternative models
3. Consider upgrading your API plan for higher quotas

## API Reference

### Generate Image

```typescript
editVisionImage(
  images: string[],           // [baseImage, ...referenceImages]
  prompt: string,             // Scene description
  embeddedText?: string,      // Text to embed in image
  titleText?: string,         // Title for vision board
  style?: string,             // 'photorealistic', 'cinematic', etc.
  aspectRatio?: string,       // '4:3', '16:9', etc.
  identityPrompt?: string,    // Identity descriptions
  referenceImageTags?: string[] // Tags for each reference
): Promise<VisionGenerationResult | null>
```

### Validate Likeness

```typescript
validateLikeness(
  referenceImages: string[],      // Base64 reference images
  generatedImage: string,         // Base64 generated image
  referenceDescriptions?: string[] // Optional descriptions
): Promise<LikenessValidationResult | null>
```

## Changelog

### v2.0.0 (2024-12-11)
- Upgraded to Nano Banana Pro as primary model
- Implemented multi-turn conversation structure for likeness
- Added likeness validation with scoring
- Added model_used tracking to vision_boards
- Created diagnostics table for audit trail
