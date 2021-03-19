import { getGreeting } from './getGreeting';

describe('getGreeting', () => {
  it('should return greeting "Hello World!"', () => {
    const result = getGreeting();

    expect(result).toBeDefined();
    expect(result.greeting).toBe('Hello World!');
  });
});
