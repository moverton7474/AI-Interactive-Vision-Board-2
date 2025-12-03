-- Create Credit Transactions Table
CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    amount INT NOT NULL, -- Positive for purchase, negative for usage
    description TEXT NOT NULL, -- e.g., "Vision Generation", "Credit Purchase"
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view own transactions" ON public.credit_transactions;
CREATE POLICY "Users can view own transactions"
ON public.credit_transactions FOR SELECT
USING (auth.uid() = user_id);

-- Only service role can insert transactions (for now, or maybe users can insert usage?)
-- Actually, for usage (deduction), the user triggers it from the client in the current implementation.
-- So we need to allow INSERT for users if they are deducting their own credits?
-- Ideally, this should be done via Edge Function to prevent tampering.
-- But for now, since we are doing client-side deduction in App.tsx, we might need to allow INSERT.
-- However, App.tsx currently only updates `profiles`. It doesn't insert into `credit_transactions` yet.
-- We should update App.tsx to also log the transaction.

DROP POLICY IF EXISTS "Users can insert own transactions" ON public.credit_transactions;
CREATE POLICY "Users can insert own transactions"
ON public.credit_transactions FOR INSERT
WITH CHECK (auth.uid() = user_id);
