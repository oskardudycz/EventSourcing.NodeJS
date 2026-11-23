const prefix = 'urn';
const separator = ':';

type Segments = [prefix: string, namespace: string, type: string, tail: string];

const segmentsOf = (urn: string): Segments => {
  if (!urn || urn.trim() === '')
    throw new Error(`Urn cannot be empty, but was: '${urn}'`);

  const [urnPrefix, namespace, type, ...tail] = urn.split(separator);

  if (
    urnPrefix !== prefix ||
    namespace === undefined ||
    type === undefined ||
    tail.length === 0
  )
    throw new Error(
      `Urn has to be 'urn:<namespace>:<type>:<tail>', but was: '${urn}'`,
    );

  return [urnPrefix, namespace, type, tail.join(separator)];
};

const required = (segment: string, name: string): string => {
  if (!segment || segment.trim() === '')
    throw new Error(`Urn ${name} cannot be empty, but was: '${segment}'`);
  return segment;
};

const namespaceOf = (urn: string) => segmentsOf(urn)[1];
const typeOf = (urn: string) => segmentsOf(urn)[2];
const tailOf = (urn: string) => segmentsOf(urn)[3];

export const Urns = {
  of: (namespace: string, type: string, tail: string): string =>
    [
      prefix,
      required(namespace, 'namespace'),
      required(type, 'type'),
      required(tail, 'tail'),
    ].join(separator),
  derive: (urn: string, type: string): string =>
    Urns.of(namespaceOf(urn), type, tailOf(urn)),
  requireType: (urn: string, type: string): string => {
    const actual = typeOf(urn);
    if (actual !== type)
      throw new Error(
        `Urn has to be of type '${type}', but was '${actual}': '${urn}'`,
      );
    return urn;
  },
  routingKeyOf: (urn: string): string =>
    [namespaceOf(urn), typeOf(urn), tailOf(urn)].join('.'),
  namespaceOf,
  typeOf,
  tailOf,
};
