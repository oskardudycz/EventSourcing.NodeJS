export function pipe<T1, R1, R2>(
  f1: (arg?: T1) => R1,
  f2: (arg: R1) => R2
): (arg?: T1) => R2;

export function pipe<T1, R1, R2, R3>(
  f1: (arg: T1) => R1,
  f2: (arg: R1) => R2,
  f3: (arg: R2) => R3
): (arg?: T1) => R3;

export function pipe<T1, R1, R2, R3, R4>(
  f1: (arg?: T1) => R1,
  f2: (arg: R1) => R2,
  f3: (arg: R2) => R3,
  f4: (arg: R3) => R4
): (arg?: T1) => R4;

export function pipe<T1, R1, R2, R3, R4, R5>(
  f1: (arg: T1) => R1,
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
