export type SearchParamsInput = Record<string, string | string[] | undefined>;

export function toUrlSearchParams(input?: SearchParamsInput): URLSearchParams {
  const params = new URLSearchParams();
  Object.entries(input ?? {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined) params.append(key, item);
      });
    } else if (value !== undefined) {
      params.set(key, value);
    }
  });
  return params;
}
