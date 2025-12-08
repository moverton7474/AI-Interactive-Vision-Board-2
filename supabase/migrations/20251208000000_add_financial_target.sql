-- Add financial_target column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS financial_target NUMERIC DEFAULT 0;

COMMENT ON COLUMN profiles.financial_target IS 'The user''s primary financial goal amount (e.g. 1000000)';
