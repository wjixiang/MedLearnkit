-- 试题讨论评论表
CREATE TABLE IF NOT EXISTS discussion_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id VARCHAR(100) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES discussion_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discussion_comments_quiz_id
    ON discussion_comments(quiz_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_discussion_comments_parent_id
    ON discussion_comments(parent_id) WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_discussion_comments_user_id
    ON discussion_comments(user_id);
