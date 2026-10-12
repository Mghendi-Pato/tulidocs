-- Sessions issued before a password reset/change are rejected (signs other devices out)
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
