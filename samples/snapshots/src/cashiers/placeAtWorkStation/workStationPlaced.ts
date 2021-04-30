import { Event } from '../../core/events';

export type PlacedAtWorkStation = Event<
  'placed-at-workstation',
  {
    cashRegisterId: string;
    workstation: string;
  }
>;
