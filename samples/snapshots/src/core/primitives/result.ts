export type Success<R = never> = { isError: false; isSuccess: true; value: R };

export type Failure<E = never> = { isError: true; isSuccess: false; value: E };

export type Result<R = never, E = never> = Success<R> | Failure<E>;

export function success<Result = never>(value: Result): Success<Result> {
  return { isError: false, isSuccess: true, value };
}

export function succeeded<R, E>(value: Result<R, E>): value is Success<R> {
  return value.isError === false;
}

export function failure<E = never>(error: E): Failure<E> {
  return { isError: true, isSuccess: false, value: error };
}

export function failed<R, E>(result: Result<R, E>): result is Failure<E> {
  return result.isError === true;
}

export function failedWith<R, E>(
  result: Result<R, E>,
  check: (r: E) => boolean
): result is Failure<E> {
  return result.isError === true && check(result.value);
}

export function isFailureOf<R, E>(
  result: Result<R, E>,
  ...failures: E[]
): result is Failure<E> {
  return result.isError === true && failures.includes(result.value);
}
