-- Add createdAt column to Quiz table if it doesn't exist
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP DEFAULT NOW();
