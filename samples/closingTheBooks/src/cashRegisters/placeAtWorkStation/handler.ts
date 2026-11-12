import type { Command } from '#core/commands';
import type { Event } from '#core/events';
import type { Result } from '#core/primitives';
import { getCurrentTime, success } from '#core/primitives';

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

export function isPlacedAtWorkStation(
  event: Event,
): event is PlacedAtWorkStation {
  return event.type === 'placed-at-workstation';
}

export function handlePlaceAtWorkStation(
  command: PlaceAtWorkStation,
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
