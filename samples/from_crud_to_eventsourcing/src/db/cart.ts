import type { ValueTransformer } from 'typeorm';
import { EntitySchema } from 'typeorm';
import { config } from '#config';

export type Cart = {
  id: number;
  userId: number | null;
  sessionId: string;
  status: number;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  mobile: string | null;
  email: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  createdAt: Date;
  updatedAt: Date | null;
  content: string | null;
};

export type CartItem = {
  id: number;
  cartId: number;
  productId: number;
  sku: string;
  price: number;
  discount: number;
  quantity: number;
  createdAt: Date;
  updatedAt: Date | null;
  content: string | null;
};

const bigintAsNumber: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

export const cartSchema = new EntitySchema<Cart>({
  name: 'cart',
  schema: config.postgres.schemaName,
  columns: {
    id: {
      type: 'bigint',
      primary: true,
      generated: 'increment',
      transformer: bigintAsNumber,
    },
    userId: { type: 'bigint', nullable: true, transformer: bigintAsNumber },
    sessionId: { type: 'varchar', length: 100, unique: true },
    status: { type: 'smallint' },
    firstName: { type: 'varchar', length: 50, nullable: true },
    middleName: { type: 'varchar', length: 50, nullable: true },
    lastName: { type: 'varchar', length: 50, nullable: true },
    mobile: { type: 'varchar', length: 50, nullable: true },
    email: { type: 'varchar', length: 50, nullable: true },
    line1: { type: 'varchar', length: 50, nullable: true },
    line2: { type: 'varchar', length: 50, nullable: true },
    city: { type: 'varchar', length: 50, nullable: true },
    province: { type: 'varchar', length: 50, nullable: true },
    country: { type: 'varchar', length: 50, nullable: true },
    createdAt: { type: 'timestamptz' },
    updatedAt: { type: 'timestamptz', nullable: true },
    content: { type: 'text', nullable: true },
  },
});

export const cartItemSchema = new EntitySchema<CartItem>({
  name: 'cart_item',
  schema: config.postgres.schemaName,
  columns: {
    id: {
      type: 'bigint',
      primary: true,
      generated: 'increment',
      transformer: bigintAsNumber,
    },
    cartId: { type: 'bigint', transformer: bigintAsNumber },
    productId: { type: 'bigint', transformer: bigintAsNumber },
    sku: { type: 'varchar', length: 100 },
    price: { type: 'float' },
    discount: { type: 'float' },
    quantity: { type: 'smallint' },
    createdAt: { type: 'timestamptz' },
    updatedAt: { type: 'timestamptz', nullable: true },
    content: { type: 'text', nullable: true },
  },
});
