-- Add smart_optimization_enabled flag to user_comm_preferences

ALTER TABLE user_comm_preferences
ADD COLUMN IF NOT EXISTS smart_optimization_enabled BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN user_comm_preferences.smart_optimization_enabled IS 'If true, AI optimizes notification times based on user activity';
