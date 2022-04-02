CREATE SCHEMA "ecommerce";

CREATE TABLE "ecommerce"."cart"
(
    "id"         BIGSERIAL,
    "userId"     BIGINT       NULL     DEFAULT NULL,
    "sessionId"  VARCHAR(100) NOT NULL,
    "token"      VARCHAR(100) NOT NULL,
    "status"     SMALLINT     NOT NULL DEFAULT 0,
    "firstName"  VARCHAR(50)  NULL     DEFAULT NULL,
    "middleName" VARCHAR(50)  NULL     DEFAULT NULL,
    "lastName"   VARCHAR(50)  NULL     DEFAULT NULL,
    "mobile"     VARCHAR(15)  NULL,
    "email"      VARCHAR(50)  NULL,
    "line1"      VARCHAR(50)  NULL     DEFAULT NULL,
    "line2"      VARCHAR(50)  NULL     DEFAULT NULL,
    "city"       VARCHAR(50)  NULL     DEFAULT NULL,
    "province"   VARCHAR(50)  NULL     DEFAULT NULL,
    "country"    VARCHAR(50)  NULL     DEFAULT NULL,
    "createdAt"  DATE         NOT NULL,
    "updatedAt"  DATE         NULL     DEFAULT NULL,
    "content"    TEXT         NULL     DEFAULT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE "ecommerce"."cart_item"
(
    "id"        BIGSERIAL,
    "productId" BIGINT       NOT NULL,
    "cartId"    BIGINT       NOT NULL,
    "sku"       VARCHAR(100) NOT NULL,
    "price"     FLOAT        NOT NULL DEFAULT 0,
    "discount"  FLOAT        NOT NULL DEFAULT 0,
    "quantity"  SMALLINT     NOT NULL DEFAULT 0,
    "active"    BOOLEAN      NOT NULL DEFAULT FALSE,
    "createdAt" DATE         NOT NULL,
    "updatedAt" DATE         NULL     DEFAULT NULL,
    "content"   TEXT         NULL     DEFAULT NULL,
    PRIMARY KEY ("id"),
    CONSTRAINT "fk_cart_item_cart"
        FOREIGN KEY("cartId")
        REFERENCES "ecommerce"."cart" ("id")
            ON DELETE CASCADE 
            ON UPDATE NO ACTION 
);
