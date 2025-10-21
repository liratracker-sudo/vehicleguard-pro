-- Corrigir política RLS incorreta na tabela payment_notification_settings
DROP POLICY IF EXISTS "Company can insert own notification settings" ON payment_notification_settings;

CREATE POLICY "Company can insert own notification settings" 
ON payment_notification_settings 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.company_id = payment_notification_settings.company_id
  )
);