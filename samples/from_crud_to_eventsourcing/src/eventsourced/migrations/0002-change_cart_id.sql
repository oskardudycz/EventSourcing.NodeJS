-- Change "cart" table id from BIGSERIAL to regular BIGINT.
-- Now it will be assigned from the event instead of automatically created.
ALTER TABLE "ecommerce"."cart" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "ecommerce"."cart" ALTER COLUMN "id" SET DATA TYPE BIGINT;

-- Do the same for "cart_items" table
ALTER TABLE "ecommerce"."cart_item" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "ecommerce"."cart_item" ALTER COLUMN "id" SET DATA TYPE BIGINT;

-- Add stream revision column, to track last processed event position
-- That's useful for idempotency 
ALTER TABLE "ecommerce"."cart" ADD COLUMN "revision" BIGINT NOT NULL DEFAULT 0;