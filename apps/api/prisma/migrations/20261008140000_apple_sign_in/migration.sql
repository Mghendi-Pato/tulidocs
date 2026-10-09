-- Sign in with Apple
ALTER TABLE "User" ADD COLUMN "appleId" TEXT;
CREATE UNIQUE INDEX "User_appleId_key" ON "User"("appleId");
