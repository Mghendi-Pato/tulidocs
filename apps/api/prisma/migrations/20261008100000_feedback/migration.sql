-- Public feedback board: posts, one vote per account, comments

CREATE TYPE "FeedbackCategory" AS ENUM ('FEATURE', 'IMPROVEMENT', 'BUG');
CREATE TYPE "FeedbackStatus" AS ENUM ('OPEN', 'PLANNED', 'IN_PROGRESS', 'DONE', 'DECLINED');

CREATE TABLE "FeedbackPost" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" "FeedbackCategory" NOT NULL DEFAULT 'FEATURE',
    "status" "FeedbackStatus" NOT NULL DEFAULT 'OPEN',
    "authorId" UUID,
    "authorName" TEXT NOT NULL,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeedbackPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeedbackVote" (
    "postId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedbackVote_pkey" PRIMARY KEY ("postId", "userId")
);

CREATE TABLE "FeedbackComment" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "authorId" UUID,
    "authorName" TEXT NOT NULL,
    "isTeam" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedbackComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FeedbackPost_status_voteCount_idx" ON "FeedbackPost"("status", "voteCount");
CREATE INDEX "FeedbackPost_createdAt_idx" ON "FeedbackPost"("createdAt");
CREATE INDEX "FeedbackVote_userId_idx" ON "FeedbackVote"("userId");
CREATE INDEX "FeedbackComment_postId_createdAt_idx" ON "FeedbackComment"("postId", "createdAt");

ALTER TABLE "FeedbackPost" ADD CONSTRAINT "FeedbackPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeedbackVote" ADD CONSTRAINT "FeedbackVote_postId_fkey" FOREIGN KEY ("postId") REFERENCES "FeedbackPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedbackVote" ADD CONSTRAINT "FeedbackVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedbackComment" ADD CONSTRAINT "FeedbackComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "FeedbackPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedbackComment" ADD CONSTRAINT "FeedbackComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
