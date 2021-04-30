import { Event } from '../../core/events';
import { CashRegister } from '../cashRegister';

export type CashRegisterSnapshoted = Event<
  'cash-register-snapshoted',
  CashRegister
>;
