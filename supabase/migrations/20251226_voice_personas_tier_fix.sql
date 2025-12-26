-- ============================================
-- Migration: Voice Personas Tier Fix
-- Date: 2025-12-26
-- Description: Fixes tier/provider mismatch for premium voices
--
-- Issues Fixed:
-- 1. ElevenLabs should only be available for Elite tier
-- 2. OpenAI should be available for Pro and Elite tiers
-- 3. UI needs to know which provider is used per tier
-- 4. Add missing 'tonya' persona if not exists
-- ============================================

-- ============================================
-- 1. ADD PROVIDER-SPECIFIC TIER COLUMNS
-- ============================================

-- Add columns to track which tiers can use which provider for each persona
ALTER TABLE voice_personas
ADD COLUMN IF NOT EXISTS openai_tiers TEXT[] DEFAULT '{pro, elite}';

ALTER TABLE voice_personas
ADD COLUMN IF NOT EXISTS elevenlabs_tiers TEXT[] DEFAULT '{elite}';

-- Add column to track if this persona uses browser TTS (for system voice)
ALTER TABLE voice_personas
ADD COLUMN IF NOT EXISTS browser_tiers TEXT[] DEFAULT '{free, pro, elite}';

-- ============================================
-- 2. UPDATE EXISTING PERSONAS WITH CORRECT TIERS
-- ============================================

-- Maya: OpenAI for Pro/Elite, ElevenLabs for Elite only
UPDATE voice_personas
SET
    openai_tiers = '{pro, elite}',
    elevenlabs_tiers = '{elite}',
    browser_tiers = '{}'
WHERE name = 'maya';

-- James: OpenAI for Pro/Elite, ElevenLabs for Elite only
UPDATE voice_personas
SET
    openai_tiers = '{pro, elite}',
    elevenlabs_tiers = '{elite}',
    browser_tiers = '{}'
WHERE name = 'james';

-- Tonya: OpenAI for Pro/Elite, ElevenLabs for Elite only
UPDATE voice_personas
SET
    openai_tiers = '{pro, elite}',
    elevenlabs_tiers = '{elite}',
    browser_tiers = '{}'
WHERE name = 'tonya';

-- System: Browser only for all tiers
UPDATE voice_personas
SET
    openai_tiers = '{}',
    elevenlabs_tiers = '{}',
    browser_tiers = '{free, pro, elite}'
WHERE name = 'system';

-- ============================================
-- 3. ENSURE TONYA EXISTS IN voice_personas
-- ============================================

INSERT INTO voice_personas (
    name,
    display_name,
    description,
    openai_voice,
    elevenlabs_voice_id,
    gender,
    style,
    available_tiers,
    openai_tiers,
    elevenlabs_tiers,
    browser_tiers
)
VALUES (
    'tonya',
    'Coach Tonya',
    'Warm, compassionate female coach with a nurturing approach. Great for emotional support and self-care sessions.',
    'shimmer',
    'zwbQ2XUiIlOKD6b3JWXd',
    'female',
    'warm',
    '{pro, elite}',
    '{pro, elite}',
    '{elite}',
    '{}'
)
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    openai_voice = EXCLUDED.openai_voice,
    elevenlabs_voice_id = EXCLUDED.elevenlabs_voice_id,
    gender = EXCLUDED.gender,
    style = EXCLUDED.style,
    available_tiers = EXCLUDED.available_tiers,
    openai_tiers = EXCLUDED.openai_tiers,
    elevenlabs_tiers = EXCLUDED.elevenlabs_tiers,
    browser_tiers = EXCLUDED.browser_tiers;

-- ============================================
-- 4. CREATE FUNCTION TO GET PERSONA WITH PROVIDER INFO
-- ============================================

CREATE OR REPLACE FUNCTION get_voice_personas_with_provider(p_user_tier TEXT)
RETURNS TABLE (
    name TEXT,
    display_name TEXT,
    description TEXT,
    gender TEXT,
    style TEXT,
    preview_url TEXT,
    available BOOLEAN,
    effective_provider TEXT,
    openai_voice TEXT,
    elevenlabs_voice_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        vp.name,
        vp.display_name,
        vp.description,
        vp.gender,
        vp.style,
        vp.preview_url,
        -- Available if tier is in available_tiers
        (p_user_tier = ANY(vp.available_tiers)) AS available,
        -- Determine effective provider based on tier
        CASE
            WHEN p_user_tier = ANY(vp.elevenlabs_tiers) THEN 'elevenlabs'
            WHEN p_user_tier = ANY(vp.openai_tiers) THEN 'openai'
            WHEN p_user_tier = ANY(vp.browser_tiers) THEN 'browser'
            ELSE 'browser'
        END AS effective_provider,
        vp.openai_voice,
        vp.elevenlabs_voice_id
    FROM voice_personas vp
    WHERE vp.is_active = TRUE
    ORDER BY
        CASE vp.name
            WHEN 'maya' THEN 1
            WHEN 'james' THEN 2
            WHEN 'tonya' THEN 3
            WHEN 'system' THEN 4
            ELSE 5
        END;
END;
$$;

-- ============================================
-- 5. CREATE FUNCTION TO GET EFFECTIVE PROVIDER FOR A PERSONA
-- ============================================

CREATE OR REPLACE FUNCTION get_persona_effective_provider(
    p_persona_name TEXT,
    p_user_tier TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_provider TEXT;
BEGIN
    SELECT
        CASE
            WHEN p_user_tier = ANY(elevenlabs_tiers) THEN 'elevenlabs'
            WHEN p_user_tier = ANY(openai_tiers) THEN 'openai'
            WHEN p_user_tier = ANY(browser_tiers) THEN 'browser'
            ELSE 'browser'
        END INTO v_provider
    FROM voice_personas
    WHERE name = p_persona_name AND is_active = TRUE;

    -- Default to browser if persona not found
    RETURN COALESCE(v_provider, 'browser');
END;
$$;

-- ============================================
-- 6. UPDATE voice-settings RPC TO INCLUDE PROVIDER INFO
-- ============================================

-- Drop and recreate the enhanced get_user_voice_settings function
CREATE OR REPLACE FUNCTION get_user_voice_settings_enhanced(p_user_id UUID, p_user_tier TEXT)
RETURNS TABLE (
    preferred_provider TEXT,
    preferred_persona TEXT,
    custom_voice_id TEXT,
    custom_voice_name TEXT,
    custom_voice_status TEXT,
    language TEXT,
    voice_speed FLOAT,
    voice_pitch FLOAT,
    auto_play_affirmations BOOLEAN,
    use_cloned_voice_for_affirmations BOOLEAN,
    effective_provider TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_settings RECORD;
    v_effective_provider TEXT;
BEGIN
    -- Get user settings
    SELECT
        uvs.preferred_provider,
        uvs.preferred_persona,
        uvs.custom_voice_id,
        uvs.custom_voice_name,
        uvs.custom_voice_status,
        uvs.language,
        uvs.voice_speed,
        uvs.voice_pitch,
        uvs.auto_play_affirmations,
        uvs.use_cloned_voice_for_affirmations
    INTO v_settings
    FROM user_voice_settings uvs
    WHERE uvs.user_id = p_user_id;

    -- If no settings, use defaults
    IF v_settings IS NULL THEN
        v_settings := ROW(
            'browser',  -- preferred_provider
            'maya',     -- preferred_persona
            NULL,       -- custom_voice_id
            NULL,       -- custom_voice_name
            'none',     -- custom_voice_status
            'en',       -- language
            1.0,        -- voice_speed
            1.0,        -- voice_pitch
            TRUE,       -- auto_play_affirmations
            FALSE       -- use_cloned_voice_for_affirmations
        );
    END IF;

    -- Get effective provider for the preferred persona
    v_effective_provider := get_persona_effective_provider(
        COALESCE(v_settings.preferred_persona, 'maya'),
        p_user_tier
    );

    RETURN QUERY SELECT
        v_settings.preferred_provider,
        v_settings.preferred_persona,
        v_settings.custom_voice_id,
        v_settings.custom_voice_name,
        v_settings.custom_voice_status,
        v_settings.language,
        v_settings.voice_speed,
        v_settings.voice_pitch,
        v_settings.auto_play_affirmations,
        v_settings.use_cloned_voice_for_affirmations,
        v_effective_provider;
END;
$$;

-- ============================================
-- 7. ADD INDEX FOR FASTER TIER LOOKUPS
-- ============================================

CREATE INDEX IF NOT EXISTS idx_voice_personas_tiers
ON voice_personas USING GIN (available_tiers);

CREATE INDEX IF NOT EXISTS idx_voice_personas_openai_tiers
ON voice_personas USING GIN (openai_tiers);

CREATE INDEX IF NOT EXISTS idx_voice_personas_elevenlabs_tiers
ON voice_personas USING GIN (elevenlabs_tiers);

-- ============================================
-- 8. GRANT PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION get_voice_personas_with_provider(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_persona_effective_provider(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_voice_settings_enhanced(UUID, TEXT) TO authenticated;

-- ============================================
-- 9. ADD COMMENT FOR DOCUMENTATION
-- ============================================

COMMENT ON FUNCTION get_voice_personas_with_provider IS
'Returns all active voice personas with their effective provider based on user tier.
Elite tier gets ElevenLabs for premium personas.
Pro tier gets OpenAI for premium personas.
Free tier gets browser TTS only.';

COMMENT ON FUNCTION get_persona_effective_provider IS
'Returns the effective TTS provider for a specific persona based on user tier.
Used by voice-tts-router to determine which API to call.';

COMMENT ON FUNCTION get_user_voice_settings_enhanced IS
'Returns user voice settings along with the effective provider for their preferred persona.
This helps the frontend display the correct provider badge.';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
