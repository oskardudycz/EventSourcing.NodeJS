/**
 * !!! This file is autogenerated do not edit by hand !!!
 *
 * Generated by: @databases/pg-schema-print-types
 * Checksum: DufDbA1YEZNTQ33HmIyEy2AURJW/uAwj2kovyxn7V+pRPnzOR6fseBLSAi4qLDetuj2wMvB74+OnFygJO/NRSQ==
 */

/* eslint-disable */
// tslint:disable

interface SubscriptionCheckpoint {
  id: string & {readonly __brand?: 'subscription_checkpoint_id'}
  position: number
}
export default SubscriptionCheckpoint;

interface SubscriptionCheckpoint_InsertParameters {
  id: string & {readonly __brand?: 'subscription_checkpoint_id'}
  position: number
}
export type {SubscriptionCheckpoint_InsertParameters}
