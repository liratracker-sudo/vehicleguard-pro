-- Add description column for standalone payments
ALTER TABLE payment_transactions 
ADD COLUMN description text;