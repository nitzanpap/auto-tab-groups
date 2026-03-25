/**
 * Retries a tab/group operation on transient "cannot be edited right now" errors.
 * Uses exponential backoff: 25 → 50 → 100 → 200 → 400ms (~775ms total).
 * Re-throws non-transient errors immediately.
 */
export async function withTabEditRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 5,
  initialDelayMs = 25
): Promise<T> {
  let delayMs = initialDelayMs

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const isTransientError = errorMessage.includes("cannot be edited right now")

      if (isTransientError && attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs))
        delayMs *= 2
        continue
      }

      throw error
    }
  }

  // Unreachable, but TypeScript requires it
  throw new Error("Max retries exceeded")
}
