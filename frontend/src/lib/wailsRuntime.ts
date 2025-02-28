declare global {
  interface Window {
    go?: {
      main?: {
        App?: unknown;
      };
    };
  }
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

export class RuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuntimeError';
  }
}

const checkRuntime = (): boolean => {
  try {
    return !!(window.go?.main?.App);
  } catch {
    return false;
  }
};

export const waitForRuntime = async (retries = MAX_RETRIES): Promise<void> => {
  if (checkRuntime()) {
    return;
  }

  if (retries <= 0) {
    throw new RuntimeError('Runtime não disponível');
  }

  await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (MAX_RETRIES - retries + 1)));
  return waitForRuntime(retries - 1);
};

export const withRuntime = async <T>(
  operation: () => Promise<T>,
  fallback?: T
): Promise<T> => {
  try {
    await waitForRuntime();
    return await operation();
  } catch (error) {
    if (error instanceof RuntimeError && fallback !== undefined) {
      console.debug('Runtime error, using fallback:', error);
      return fallback;
    }
    throw error;
  }
}; 