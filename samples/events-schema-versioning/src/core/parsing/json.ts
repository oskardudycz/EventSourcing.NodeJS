export function serializeToJSON(obj: any): string {
  return JSON.stringify(obj);
}

export function deserializeFromJSON<T>(json: string): T {
  return JSON.parse(json, reviver);
}

const iso8601DateFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function reviver(_key: any, value: any): any {
  if (typeof value === 'string' && iso8601DateFormat.test(value)) {
    return new Date(value);
  }

  return value;
}
