-- Visitors can vote too: votes are keyed by a voter key ("u:<userId>" or "v:<cookie id>")
ALTER TABLE "FeedbackVote" DROP CONSTRAINT "FeedbackVote_pkey";
ALTER TABLE "FeedbackVote" ADD COLUMN "voterKey" TEXT;
UPDATE "FeedbackVote" SET "voterKey" = 'u:' || "userId"::text;
ALTER TABLE "FeedbackVote" ALTER COLUMN "voterKey" SET NOT NULL;
ALTER TABLE "FeedbackVote" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "FeedbackVote" ADD CONSTRAINT "FeedbackVote_pkey" PRIMARY KEY ("postId", "voterKey");
