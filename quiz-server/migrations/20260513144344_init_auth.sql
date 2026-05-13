-- 用户基础表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50),
    email VARCHAR(255) UNIQUE NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 认证方式表（支持多种登录方式）
-- provider: 'email' | 'google' | 'github' | ...
-- email 登录时 password_hash 必填
-- 第三方登录时 provider_id 必填
CREATE TABLE IF NOT EXISTS user_auth_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL DEFAULT 'email',
    provider_id TEXT,
    password_hash VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(provider, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_user_auth_methods_user_id ON user_auth_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_user_auth_methods_provider ON user_auth_methods(provider);

-- 练习记录表
CREATE TABLE IF NOT EXISTS practice_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quiz_id VARCHAR(100) NOT NULL,
    user_answer TEXT,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    time_spent_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_practice_user_id ON practice_records(user_id);
CREATE INDEX IF NOT EXISTS idx_practice_quiz_id ON practice_records(quiz_id);
CREATE INDEX IF NOT EXISTS idx_practice_created_at ON practice_records(created_at DESC);

-- 试卷记录表
CREATE TABLE IF NOT EXISTS paper_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    paper_id VARCHAR(100) NOT NULL,
    score DECIMAL(5,2),
    total_questions INTEGER NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paper_records_user_id ON paper_records(user_id);
CREATE INDEX IF NOT EXISTS idx_paper_records_paper_id ON paper_records(paper_id);
CREATE INDEX IF NOT EXISTS idx_paper_records_created_at ON paper_records(created_at DESC);

-- 试卷答题明细表
CREATE TABLE IF NOT EXISTS paper_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_record_id UUID NOT NULL REFERENCES paper_records(id) ON DELETE CASCADE,
    quiz_id VARCHAR(100) NOT NULL,
    user_answer TEXT,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    time_spent_seconds INTEGER DEFAULT 0,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paper_answers_record_id ON paper_answers(paper_record_id);
CREATE INDEX IF NOT EXISTS idx_paper_answers_quiz_id ON paper_answers(quiz_id);
