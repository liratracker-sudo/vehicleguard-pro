-- Reset notifications falsely marked as failed due to WhatsApp connection check timeouts
UPDATE payment_notifications 
SET status = 'pending', attempts = 0, last_error = NULL, updated_at = now()
WHERE status = 'failed' 
AND last_error ILIKE '%WhatsApp desconectado%'
AND scheduled_for >= now() - interval '14 days';