-- Like / dislike instead of upvote only, and private messages to the team
ALTER TYPE "FeedbackCategory" ADD VALUE IF NOT EXISTS 'PRIVATE';
ALTER TABLE "FeedbackVote" ADD COLUMN "value" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "FeedbackPost" ADD COLUMN "downCount" INTEGER NOT NULL DEFAULT 0;
