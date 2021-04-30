import { Event } from '../../core/events';

export type ShiftStarted = Event<
  'shift-started',
  {
    cashRegisterId: string;
    cashierId: string;
    startedAt: Date;
  }
>;
