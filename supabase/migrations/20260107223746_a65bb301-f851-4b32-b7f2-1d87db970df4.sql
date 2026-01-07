-- Add columns to track cancellation details for audit
ALTER TABLE payment_transactions 
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelled_by UUID;

-- Add comment for documentation
COMMENT ON COLUMN payment_transactions.cancellation_reason IS 'Reason provided when cancelling the payment';
COMMENT ON COLUMN payment_transactions.cancelled_at IS 'Timestamp when the payment was cancelled';
COMMENT ON COLUMN payment_transactions.cancelled_by IS 'User ID who cancelled the payment';