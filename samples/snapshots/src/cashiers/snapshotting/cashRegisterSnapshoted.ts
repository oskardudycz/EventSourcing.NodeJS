import { SnapshotEvent } from '../../core/eventStore/snapshotting/snapshotEvent';
import { CashRegister } from '../cashRegister';

export type CashRegisterSnapshotted = SnapshotEvent<
  'cash-register-snapshotted',
  CashRegister
>;
