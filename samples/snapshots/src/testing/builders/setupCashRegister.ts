import request from 'supertest';

export async function setupCashRegister(
  app: Express.Application,
): Promise<string> {
  let cashRegisterId: string = '';
  await request(app)
    .post('/cash-registers/')
    .send({ workstation: 'WS#1' })
    .expect(201)
    .expect((res) => {
      cashRegisterId = res.body.id;
    });

  return cashRegisterId;
}
