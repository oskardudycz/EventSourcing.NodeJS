export type Success<R = never> = { isError: false; value: R };
export type Failure<E = never> = { isError: true; error: E };

export type Result<R = never, E = never> = Success<R> | Failure<E>;

export function success<Result = never>(value: Result): Success<Result> {
  return { isError: false, value };
}

export function failure<E = never>(error: E): Failure<E> {
  return { isError: true, error };
}

export function toResult(succeeded: boolean): Result<true, false> {
  return succeeded ? success(true) : failure(false);
}
