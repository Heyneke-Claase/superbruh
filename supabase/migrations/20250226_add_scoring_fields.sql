-- Migration: Add scoring fields for automatic match scoring
-- This enables idempotent scoring - matches are only scored once

-- Add scoredAt timestamp to Match table
-- This tracks when a match was last scored (null = not scored yet)
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "scoredAt" TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add index for efficient querying of unscored matches
CREATE INDEX IF NOT EXISTS "idx_match_scored_at" ON "Match"("scoredAt") WHERE "matchEnded" = true;

-- Add points and result fields to Prediction table
-- These store the calculated points for each pick
ALTER TABLE "Prediction" ADD COLUMN IF NOT EXISTS "points" INTEGER DEFAULT 0;
ALTER TABLE "Prediction" ADD COLUMN IF NOT EXISTS "result" VARCHAR(20) DEFAULT NULL;
ALTER TABLE "Prediction" ADD COLUMN IF NOT EXISTS "scoredAt" TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add index for efficient querying of scored predictions
CREATE INDEX IF NOT EXISTS "idx_prediction_scored_at" ON "Prediction"("scoredAt");
CREATE INDEX IF NOT EXISTS "idx_prediction_points" ON "Prediction"("points") WHERE "points" > 0;

-- Add comment explaining the scoring system
COMMENT ON COLUMN "Match"."scoredAt" IS 'Timestamp when match was scored (null = not scored yet). Used for idempotent scoring.';
COMMENT ON COLUMN "Prediction"."points" IS 'Points earned for this prediction (0-2: 0=incorrect, 1=correct team, 2=correct margin)';
COMMENT ON COLUMN "Prediction"."result" IS 'Result classification: incorrect, correct_team, correct_margin';
COMMENT ON COLUMN "Prediction"."scoredAt" IS 'Timestamp when this prediction was scored';
