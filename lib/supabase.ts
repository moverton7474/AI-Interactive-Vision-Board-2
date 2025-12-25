import { createClient } from '@supabase/supabase-js';

// Configuration from user prompt - exported for use in other services
export const SUPABASE_URL = 'https://edaigbnnofyxcfbpcvct.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkYWlnYm5ub2Z5eGNmYnBjdmN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNTUyMTEsImV4cCI6MjA3OTczMTIxMX0.RdSqMYTuYJ5RIHQ5VQ9XquiJwbPVIl0xFznTqQXWius';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
