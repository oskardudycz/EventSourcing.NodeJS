import { handlePlaceAtWorkStation, PlaceAtWorkStation } from './handler';
import { v4 as uuid } from 'uuid';

describe('PlaceAtWorkStation command', () => {
  it('should place cash register at work station', async () => {
    const command: PlaceAtWorkStation = {
      type: 'place-at-workstation',
      data: {
        cashRegisterId: uuid(),
        workstation: 'WS#1',
      },
    };

    const result = handlePlaceAtWorkStation(command);

    if (result.isError === true) {
      expect(result.isError).toBeFalsy();
      return;
    }

    const newEvent = result.value;

    expect(newEvent).toMatchObject({
      type: 'placed-at-workstation',
      data: {
        cashRegisterId: command.data.cashRegisterId,
        workstation: command.data.workstation,
      },
    });
  });
});
