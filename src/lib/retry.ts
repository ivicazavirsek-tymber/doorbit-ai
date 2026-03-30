export type RetryOptions = {
  retries: number;
  baseMs: number;
};

const defaultOpts: RetryOptions = { retries: 3, baseMs: 600 };

export async function callWithRetry<T>(
  fn: () => Promise<T>,
  opts: Partial<RetryOptions> = {}
): Promise<T> {
  const { retries, baseMs } = { ...defaultOpts, ...opts };
  let last: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, baseMs * (attempt + 1)));
      }
    }
  }
  throw last;
}
