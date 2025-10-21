-- Fix RLS policies for company-logos bucket to use company_id instead of user_id
-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can upload company logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their company logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their company logos" ON storage.objects;

-- Create new policies that check if user belongs to the company
CREATE POLICY "Company members can upload logos"
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'company-logos' 
  AND EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.company_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Company members can update logos"
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'company-logos' 
  AND EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.company_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Company members can delete logos"
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'company-logos' 
  AND EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.company_id::text = (storage.foldername(name))[1]
  )
);