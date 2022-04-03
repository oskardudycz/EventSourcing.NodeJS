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
  if (fakeUsers.has(userId)) {
    fakeUsers.set(userId, {
      id: userId,
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName(),
      email: faker.internet.email(),
      mobile: faker.phone.phoneNumber(),
      address: {
        city: faker.address.city(),
        province: faker.address.state(),
        country: faker.address.country(),
      },
    });
  }
  return Promise.resolve(fakeUsers.get(userId)!);
};
