import { SnapshotEvent } from '../../core/eventStore/snapshotting';
import { CashRegister } from '../cashRegister';

export type CashRegisterSnapshoted = SnapshotEvent<
  'cash-register-snapshoted',
  CashRegister
>;
