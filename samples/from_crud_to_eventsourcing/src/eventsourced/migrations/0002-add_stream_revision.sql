-- Add stream revision column, to track last processed event position
-- That's useful for idempotency
ALTER TABLE
  "ecommerce"."cart"
ADD
  COLUMN "revision" BIGINT NOT NULL DEFAULT 0;