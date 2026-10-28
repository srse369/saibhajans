export async function keepProgressVisible<T>(operation: Promise<T>, minimumDurationMs = 250): Promise<T> {
  const startedAt = Date.now();
  try {
    return await operation;
  } finally {
    const remaining = minimumDurationMs - (Date.now() - startedAt);
    if (remaining > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, remaining));
    }
  }
}