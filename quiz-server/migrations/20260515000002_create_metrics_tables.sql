-- Per-minute request metrics bucket (flushed from in-memory atomics)
CREATE TABLE IF NOT EXISTS request_metrics (
    id BIGSERIAL PRIMARY KEY,
    bucket_time TIMESTAMPTZ NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code SMALLINT NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1,
    total_duration_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_request_metrics_bucket_time
    ON request_metrics(bucket_time DESC);
CREATE INDEX IF NOT EXISTS idx_request_metrics_endpoint
    ON request_metrics(endpoint, bucket_time DESC);

-- Daily platform metrics (pre-aggregated for dashboard queries)
CREATE TABLE IF NOT EXISTS daily_platform_metrics (
    id BIGSERIAL PRIMARY KEY,
    metric_date DATE NOT NULL,
    total_requests INTEGER NOT NULL DEFAULT 0,
    total_errors INTEGER NOT NULL DEFAULT 0,
    avg_response_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
    dau INTEGER NOT NULL DEFAULT 0,
    new_registrations INTEGER NOT NULL DEFAULT 0,
    quizzes_practiced INTEGER NOT NULL DEFAULT 0,
    papers_created INTEGER NOT NULL DEFAULT 0,
    discussions_created INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(metric_date)
);

-- User daily activity for DAU/WAU/MAU computation
CREATE TABLE IF NOT EXISTS user_daily_activity (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    practice_count INTEGER NOT NULL DEFAULT 0,
    login_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, activity_date)
);

CREATE INDEX IF NOT EXISTS idx_user_daily_activity_date
    ON user_daily_activity(activity_date DESC);
