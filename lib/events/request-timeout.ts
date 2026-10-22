/** A timeout means unconfirmed, not rejected. Retry writes with the same operation ID. */
export function activityRequest<T>(request: Promise<T>, timeoutMs = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("The connection is taking longer than expected. Retry to confirm your changes.")), timeoutMs);
    request.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}
