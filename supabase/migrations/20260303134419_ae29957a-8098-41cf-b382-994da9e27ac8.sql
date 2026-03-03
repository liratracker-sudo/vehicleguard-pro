UPDATE payment_notifications 
SET status = 'pending', updated_at = now() 
WHERE status = 'sending';