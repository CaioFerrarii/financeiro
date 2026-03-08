-- Drop the insecure public policy
DROP POLICY IF EXISTS "Anyone can read authorized emails" ON public.authorized_emails;

-- Add user_id column to authorized_emails to properly scope data
ALTER TABLE public.authorized_emails 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create secure policy: users can only read their own authorized emails
CREATE POLICY "Users can read their own authorized emails"
ON public.authorized_emails
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create policy for users to insert their own authorized emails
CREATE POLICY "Users can insert their own authorized emails"
ON public.authorized_emails
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create policy for users to delete their own authorized emails
CREATE POLICY "Users can delete their own authorized emails"
ON public.authorized_emails
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create policy for users to update their own authorized emails
CREATE POLICY "Users can update their own authorized emails"
ON public.authorized_emails
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);