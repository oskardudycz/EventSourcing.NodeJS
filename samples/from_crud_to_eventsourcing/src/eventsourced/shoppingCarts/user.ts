import { faker } from '@faker-js/faker';
export interface UserAddress {
  city: string;
  country: string;
  province: string;
}

export interface User {
  id: number;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  mobile?: string;
  address: UserAddress;
}

const fakeUsers = new Map<number, User>();

export const getUserData = (userId: number) => {
  if (!fakeUsers.has(userId)) {
    fakeUsers.set(userId, {
      id: userId,
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: faker.internet.email(),
      mobile: faker.phone.number(),
      address: {
        city: faker.location.city(),
        province: faker.location.state(),
        country: faker.location.country(),
      },
    });
  }
  return Promise.resolve(fakeUsers.get(userId));
};
