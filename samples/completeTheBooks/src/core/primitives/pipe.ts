import { Result, success } from './result';
import { switchError, switchErrorAsync } from './switchError';

export function pipe<T1, R1, R2>(
  f1: ((arg: T1) => R1) | (() => R1),
  f2: (arg: R1) => R2
): (arg?: T1) => R2;

export function pipe<T1, R1, R2, R3>(
  f1: ((arg: T1) => R1) | (() => R1),
  f2: (arg: R1) => R2,
  f3: (arg: R2) => R3
): (arg?: T1) => R3;

export function pipe<T1, R1, R2, R3, R4>(
  f1: ((arg: T1) => R1) | (() => R1),
  f2: (arg: R1) => R2,
  f3: (arg: R2) => R3,
  f4: (arg: R3) => R4
): (arg?: T1) => R4;

export function pipe<T1, R1, R2, R3, R4, R5>(
  f1: ((arg: T1) => R1) | (() => R1),
  f2: (arg: R1) => R2,
  f3: (arg: R2) => R3,
  f4: (arg: R3) => R4,
  f5: (arg: R4) => R5
): (arg?: T1) => R5;

export function pipe(
  fn1: (...args: any[]) => any,
  ...fns: Array<(a: any) => any>
): (a: any) => any {
  return fns.reduce((prevFn, nextFn) => (value) => nextFn(prevFn(value)), fn1);
}

export function pipeResult<T1, R1, R2, E1 = never, E2 = never>(
  f1: ((arg: T1) => Result<R1, E1>) | (() => Result<R1, E1>),
  f2: (arg: R1) => Result<R2, E2>
): (arg?: T1) => Result<R2, E1 | E2>;

export function pipeResult<T1, R1, R2, R3, E1 = never, E2 = never, E3 = never>(
  f1: ((arg: T1) => Result<R1, E1>) | (() => Result<R1, E1>),
  f2: (arg: R1) => Result<R2, E2>,
  f3: (arg: R2) => Result<R3, E3>
): (arg?: T1) => Result<R3, E1 | E2 | E3>;

export function pipeResult<
  T1,
  R1,
  R2,
  R3,
  R4,
  E1 = never,
  E2 = never,
  E3 = never,
  E4 = never
>(
  f1: ((arg: T1) => Result<R1, E1>) | (() => Result<R1, E1>),
  f2: (arg: R1) => Result<R2, E2>,
  f3: (arg: R2) => Result<R3, E3>,
  f4: (arg: R3) => Result<R4, E4>
): (arg?: T1) => Result<R4, E1 | E2 | E3 | E4>;

export function pipeResult<
  T1,
  R1,
  R2,
  R3,
  R4,
  R5,
  E1 = never,
  E2 = never,
  E3 = never,
  E4 = never,
  E5 = never
>(
  f1: ((arg: T1) => Result<R1, E1>) | (() => Result<R1, E1>),
  f2: (arg: R1) => Result<R2, E2>,
  f3: (arg: R2) => Result<R3, E3>,
  f4: (arg: R3) => Result<R4, E4>,
  f5: (arg: R4) => Result<R5, E5>
): (arg?: T1) => Result<R5, E1 | E2 | E3 | E4 | E5>;

export function pipeResult(
  fn1: (...args: any[]) => any,
  ...fns: Array<(a: any) => any>
): (a: any) => any {
  return fns
    .map((f) => switchError(f))
    .reduce((prevFn, nextFn) => (value) => nextFn(prevFn(value)), fn1);
}

export function pipeResultAsync<T1, R1, R2, E1 = never, E2 = never>(
  f1: ((arg: T1) => Promise<Result<R1, E1>>) | (() => Promise<Result<R1, E1>>),
  f2: (arg: R1) => Promise<Result<R2, E2>>
): (arg?: T1) => Promise<Result<R2, E1 | E2>>;

export function pipeResultAsync<
  T1,
  R1,
  R2,
  R3,
  E1 = never,
  E2 = never,
  E3 = never
>(
  f1: ((arg: T1) => Promise<Result<R1, E1>>) | (() => Promise<Result<R1, E1>>),
  f2: (arg: R1) => Promise<Result<R2, E2>>,
  f3: (arg: R2) => Promise<Result<R3, E3>>
): (arg?: T1) => Promise<Result<R3, E1 | E2 | E3>>;

export function pipeResultAsync<
  T1,
  R1,
  R2,
  R3,
  R4,
  E1 = never,
  E2 = never,
  E3 = never,
  E4 = never
>(
  f1: ((arg: T1) => Promise<Result<R1, E1>>) | (() => Promise<Result<R1, E1>>),
  f2: (arg: R1) => Promise<Result<R2, E2>>,
  f3: (arg: R2) => Promise<Result<R3, E3>>,
  f4: (arg: R3) => Promise<Result<R4, E4>>
): (arg?: T1) => Promise<Result<R4, E1 | E2 | E3 | E4>>;

export function pipeResultAsync<
  T1,
  R1,
  R2,
  R3,
  R4,
  R5,
  E1 = never,
  E2 = never,
  E3 = never,
  E4 = never,
  E5 = never
>(
  f1: ((arg: T1) => Promise<Result<R1, E1>>) | (() => Promise<Result<R1, E1>>),
  f2: (arg: R1) => Promise<Result<R2, E2>>,
  f3: (arg: R2) => Promise<Result<R3, E3>>,
  f4: (arg: R3) => Promise<Result<R4, E4>>,
  f5: (arg: R4) => Promise<Result<R5, E5>>
): (arg?: T1) => Promise<Result<R5, E1 | E2 | E3 | E4 | E5>>;

export function pipeResultAsync<
  T1,
  R1,
  R2,
  R3,
  R4,
  R5,
  R6,
  E1 = never,
  E2 = never,
  E3 = never,
  E4 = never,
  E5 = never,
  E6 = never
>(
  f1: ((arg: T1) => Promise<Result<R1, E1>>) | (() => Promise<Result<R1, E1>>),
  f2: (arg: R1) => Promise<Result<R2, E2>>,
  f3: (arg: R2) => Promise<Result<R3, E3>>,
  f4: (arg: R3) => Promise<Result<R4, E4>>,
  f5: (arg: R4) => Promise<Result<R5, E5>>,
  f6: (arg: R5) => Promise<Result<R6, E6>>
): (arg?: T1) => Promise<Result<R5, E1 | E2 | E3 | E4 | E5 | E6>>;

export function pipeResultAsync(
  fn1: (...args: any[]) => any,
  ...fns: Array<(a: any) => any>
): (a: any) => any {
  return fns
    .map((f) => switchErrorAsync(f))
    .reduce((prevFn, nextFn) => (value) => nextFn(prevFn(value)), fn1);
}

export function forwardInputsAsResults<I, R = never, E = never>(
  callback: (input: I) => Promise<Result<R, E>>
): (input: I) => Promise<Result<R & I, E>> {
  return async (input: I) => {
    const result = await callback(input);

    if (result.isError) return result;

    return success({ ...input, ...result.value });
  };
}

export function transformResults<T = never, I = never, R = never, E = never>(
  callback: (input: I) => Promise<Result<R, E>>,
  transform: (result: R, input: I) => T
): (input: I) => Promise<Result<T, E>> {
  return async (input: I) => {
    const result = await callback(input);

    if (result.isError) return result;

    return success(transform(result.value, input));
  };
}
