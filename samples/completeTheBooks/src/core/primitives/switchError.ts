import { Result } from './result';

export function switchError<T = never, E = never, R = never, E2 = never>(
  f: (input: T) => Result<R, E2>
): (_: Result<T, E>) => Result<R, E | E2> {
  return (input: Result<T, E>) => {
    if (input.isError === true) return input;

    return f(input.value);
  };
}

export function switchErrorAsync<T = never, E = never, R = never, E2 = never>(
  f: (input: T) => Promise<Result<R, E2>>
): (_: Promise<Result<T, E>>) => Promise<Result<R, E | E2>> {
  return async (inputPromise: Promise<Result<T, E>>) => {
    const input = await inputPromise;

    if (input.isError === true) return input;

    return f(input.value);
  };
}
