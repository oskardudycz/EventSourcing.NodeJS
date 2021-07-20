import request from 'supertest';
import { v4 as uuid } from 'uuid';

export async function setupStartedShift(
  app: Express.Application,
  existingCashRegisterId: string
): Promise<string> {
  let cashRegisterId: string = '';
  await request(app)
    .post(`/cash-registers/${existingCashRegisterId}/shifts`)
    .send({ cashierId: uuid() })
    .expect(200);

  return cashRegisterId;
}
