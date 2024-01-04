import request from 'supertest';
import { App } from 'supertest/types';

export async function setupCashRegister(app: App): Promise<string> {
  let cashRegisterId: string = '';
  await request(app)
    .post('/cash-registers/')
    .send({ workstation: 'WS#1' })
    .expect(201)
    .expect((res: { body: { id: string } }) => {
      cashRegisterId = res.body.id;
    });

  return cashRegisterId;
}
