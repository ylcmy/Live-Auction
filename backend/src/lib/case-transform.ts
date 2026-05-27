function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

export function toCamelCase<T>(input: T): T {
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) return input.map(toCamelCase) as unknown as T;
  if (typeof input === 'object' && input.constructor === Object) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(input as Record<string, unknown>)) {
      result[snakeToCamel(key)] = toCamelCase((input as Record<string, unknown>)[key]);
    }
    return result as T;
  }
  if (input instanceof Date) return input;
  return input;
}
