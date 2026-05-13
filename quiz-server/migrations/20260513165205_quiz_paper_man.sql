-- 公共试卷表（系统收集的试卷，所有用户可见）
CREATE TABLE IF NOT EXISTS public_papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    quiz_ids JSONB NOT NULL DEFAULT '[]',
    quiz_count INTEGER NOT NULL DEFAULT 0,
    source VARCHAR(100),
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_papers_created_at ON public_papers(created_at DESC);

-- 私人试卷表（用户创建的试卷，仅创建者可见）
CREATE TABLE IF NOT EXISTS user_papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    quiz_ids JSONB NOT NULL DEFAULT '[]',
    quiz_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_papers_user_id ON user_papers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_papers_created_at ON user_papers(created_at DESC);

-- 用户试卷收藏表（用户收藏的公共试卷）
CREATE TABLE IF NOT EXISTS paper_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    public_paper_id UUID NOT NULL REFERENCES public_papers(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, public_paper_id)
);

CREATE INDEX IF NOT EXISTS idx_paper_favorites_user_id ON paper_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_paper_favorites_paper_id ON paper_favorites(public_paper_id);
