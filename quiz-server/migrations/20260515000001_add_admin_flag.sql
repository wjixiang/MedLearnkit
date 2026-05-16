-- Add admin flag to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Set the first user as admin
UPDATE users SET is_admin = TRUE WHERE id = (SELECT id FROM users ORDER BY created_at LIMIT 1);

CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin) WHERE is_admin = TRUE;
