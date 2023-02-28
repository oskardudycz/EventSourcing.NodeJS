export class ParseError extends Error {
  constructor(text: string) {
    super(`Cannot parse! ${text}`);
  }
}

export type ParserMapper<From, To = From> =
  | ((value: unknown) => To | undefined)
  | ((value: Partial<From>) => To | undefined)
  | ((value: From) => To | undefined)
  | ((value: Partial<To>) => To | undefined)
  | ((value: To) => To | undefined)
  | ((value: Partial<To | From>) => To | undefined)
  | ((value: To | From) => To | undefined);

export type ParseOptions<From, To = From> = {
  reviver?: (key: string, value: unknown) => unknown;
  map?: ParserMapper<From, To>;
  typeCheck?: <To>(value: unknown) => value is To;
};

export const JSONParser = {
  stringify: (value: unknown) => JSON.stringify(value),
  parse: <From, To = From>(
    text: string,
    options?: ParseOptions<From, To>
  ): To | undefined => {
    const parsed: unknown = JSON.parse(text, options?.reviver);

    if (options?.typeCheck && !options?.typeCheck<To>(parsed))
      throw new ParseError(text);

    return options?.map
      ? // Yeah, Partial<From> & From & Partial<To> & To is crazy, but well...
        options.map(parsed as Partial<From> & From & Partial<To> & To)
      : (parsed as To | undefined);
  },
};
