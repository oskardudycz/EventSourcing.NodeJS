/**
 * !!! This file is autogenerated do not edit by hand !!!
 *
 * Generated by: @databases/pg-schema-print-types
 * Checksum: 0OvlfSgZv11FyArXCyvsrCfcTiNTab41CoKglaL91AoeZobHl7RDyPfBgT8GuXHzQNQ0OmILNrSrUISfTtoTHw==
 */

/* eslint-disable */
// tslint:disable

interface Cart {
  /**
   * @default NULL::character varying
   */
  city: string | null;
  content: string | null;
  /**
   * @default NULL::character varying
   */
  country: string | null;
  createdAt: Date;
  email: string | null;
  /**
   * @default NULL::character varying
   */
  firstName: string | null;
  /**
   * @default nextval('ecommerce.cart_id_seq'::regclass)
   */
  id: number & { readonly __brand?: 'cart_id' };
  /**
   * @default NULL::character varying
   */
  lastName: string | null;
  /**
   * @default NULL::character varying
   */
  line1: string | null;
  /**
   * @default NULL::character varying
   */
  line2: string | null;
  /**
   * @default NULL::character varying
   */
  middleName: string | null;
  mobile: string | null;
  /**
   * @default NULL::character varying
   */
  province: string | null;
  /**
   * @default 0
   */
  revision: number;
  sessionId: string;
  /**
   * @default 0
   */
  status: number;
  updatedAt: Date | null;
  userId: number | null;
}
export default Cart;

interface Cart_InsertParameters {
  /**
   * @default NULL::character varying
   */
  city?: string | null;
  content?: string | null;
  /**
   * @default NULL::character varying
   */
  country?: string | null;
  createdAt: Date;
  email?: string | null;
  /**
   * @default NULL::character varying
   */
  firstName?: string | null;
  /**
   * @default nextval('ecommerce.cart_id_seq'::regclass)
   */
  id?: number & { readonly __brand?: 'cart_id' };
  /**
   * @default NULL::character varying
   */
  lastName?: string | null;
  /**
   * @default NULL::character varying
   */
  line1?: string | null;
  /**
   * @default NULL::character varying
   */
  line2?: string | null;
  /**
   * @default NULL::character varying
   */
  middleName?: string | null;
  mobile?: string | null;
  /**
   * @default NULL::character varying
   */
  province?: string | null;
  /**
   * @default 0
   */
  revision?: number;
  sessionId: string;
  /**
   * @default 0
   */
  status?: number;
  updatedAt?: Date | null;
  userId?: number | null;
}
export type { Cart_InsertParameters };
