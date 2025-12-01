-- Add DELETE policy for client_registrations
CREATE POLICY "Company members can delete registrations"
ON client_registrations
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_id = client_registrations.company_id
  )
);