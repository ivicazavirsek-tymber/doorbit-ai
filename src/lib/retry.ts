export type RetryOptions = {
  retries: number;
  baseMs: number;
  /** Ako vrati false, odmah propagira poslednju grešku (npr. 429 bez ponavljanja). */
  retryIf?: (error: unknown) => boolean;
};

const defaultOpts: RetryOptions = {
  retries: 3,
  baseMs: 600,
  retryIf: () => true,
};

export async function callWithRetry<T>(
  fn: () => Promise<T>,
  opts: Partial<RetryOptions> = {}
): Promise<T> {
  const merged = { ...defaultOpts, ...opts };
  const { retries, baseMs } = merged;
  const retryIf = merged.retryIf ?? (() => true);
  let last: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const again = attempt < retries - 1 && retryIf(e);
      if (again) {
        await new Promise((r) => setTimeout(r, baseMs * (attempt + 1)));
      } else {
        break;
      }
    }
  }
  throw last;
}
