import { Command } from '#core/commands';
import { Event } from '#core/events';
import { getCurrentTime, Result, success } from '#core/primitives';

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
): Result<PlacedAtWorkStation> {
  return success({
    type: 'placed-at-workstation',
    data: {
      cashRegisterId: command.data.cashRegisterId,
      workstation: command.data.workstation,
      placedAt: getCurrentTime(),
    },
  });
}
