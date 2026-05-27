ALTER TABLE health_logs
ADD COLUMN IF NOT EXISTS user_id INT NULL AFTER id,
ADD COLUMN IF NOT EXISTS media_path VARCHAR(255) NULL AFTER heart_rate,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER notes;

UPDATE health_logs
SET user_id = 1
WHERE user_id IS NULL;

ALTER TABLE health_logs
ADD INDEX IF NOT EXISTS idx_health_logs_user_id (user_id);

ALTER TABLE users
ADD INDEX IF NOT EXISTS idx_users_role (role),
ADD INDEX IF NOT EXISTS idx_users_approved (is_approved);

ALTER TABLE feedbacks
ADD INDEX IF NOT EXISTS idx_feedbacks_log_id (log_id),
ADD INDEX IF NOT EXISTS idx_feedbacks_admin_id (admin_id);
