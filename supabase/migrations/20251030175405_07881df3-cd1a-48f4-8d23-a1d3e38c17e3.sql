-- Enable pgcrypto extension (required for encryption functions)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Verify the extension is enabled
SELECT extname FROM pg_extension WHERE extname = 'pgcrypto';