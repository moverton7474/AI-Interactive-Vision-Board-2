-- Add Tonya voice persona
INSERT INTO voice_personas (name, display_name, description, openai_voice, elevenlabs_voice_id, gender, style, available_tiers)
VALUES
  ('tonya', 'Coach Tonya', 'Warm, compassionate female coach with a nurturing tone. Great for emotional support and reflection sessions.',
   'shimmer', 'zwbQ2XUiIlOKD6b3JWXd', 'female', 'warm', '{pro, elite}')
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  openai_voice = EXCLUDED.openai_voice,
  elevenlabs_voice_id = EXCLUDED.elevenlabs_voice_id,
  gender = EXCLUDED.gender,
  style = EXCLUDED.style,
  available_tiers = EXCLUDED.available_tiers;
