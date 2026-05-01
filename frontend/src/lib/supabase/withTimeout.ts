/**
 * withTimeout — wrap a Supabase / fetch promise in a hard timeout.
 *
 * Production has shown a class of silent stalls where supabase-js never
 * settles a request (CDN edge, RLS recursion, browser keep-alive). The
 * dashboard then spins forever. This helper guarantees the promise
 * either resolves, rejects, or rejects with a timeout — never hangs.
 *
 * Note: PostgrestBuilder is "thenable" but not strictly a Promise, so
 * callers usually wrap with `Promise.resolve(builder)` before passing
 * it here.
 */
export async function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    p.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
