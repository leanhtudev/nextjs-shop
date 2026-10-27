/** Artificial latency, so streaming is visible when slots load independently. */
export const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
