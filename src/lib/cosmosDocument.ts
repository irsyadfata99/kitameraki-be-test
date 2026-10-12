export function stripSystemFields<T>(document: object): T {
  const entries = Object.entries(document).filter(
    ([key]) => !key.startsWith("_"),
  );
  return Object.fromEntries(entries) as T;
}
