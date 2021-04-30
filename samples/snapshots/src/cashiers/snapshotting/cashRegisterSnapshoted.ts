import { SnapshotEvent } from '../../core/eventStore/snapshotting/snapshotEvent';
import { CashRegister } from '../cash-register';

export type CashRegisterSnapshoted = SnapshotEvent<
  'cash-register-snapshoted',
  CashRegister
>;
