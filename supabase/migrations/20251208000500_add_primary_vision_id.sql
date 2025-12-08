-- Add primary_vision_id column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS primary_vision_id UUID;

-- Optional: Add foreign key if valid (commented out to avoid errors if table missing, but recommended)
-- ALTER TABLE profiles
-- ADD CONSTRAINT fk_primary_vision 
-- FOREIGN KEY (primary_vision_id) REFERENCES vision_boards(id) ON DELETE SET NULL;

COMMENT ON COLUMN profiles.primary_vision_id IS 'The ID of the vision board to display on the dashboard';
