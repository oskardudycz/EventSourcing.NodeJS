import { Command } from '../../core/commands';
import { Event } from '../../core/events';

export type PlaceAtWorkStation = Command<
  'place-at-workstation',
  {
    cashRegisterId: string;
    workstation: string;
  }
>;

export type PlacedAtWorkStation = Event<
  'placed-at-workstation',
  {
    cashRegisterId: string;
    workstation: string;
    placedAt: Date;
  }
>;

export function handlePlaceAtWorkStation(
  command: PlaceAtWorkStation
): PlacedAtWorkStation {
  return {
    type: 'placed-at-workstation',
    data: {
      cashRegisterId: command.data.cashRegisterId,
      workstation: command.data.workstation,
      placedAt: new Date(),
    },
  };
}
