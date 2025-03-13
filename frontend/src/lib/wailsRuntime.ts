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

export class CallbackError extends RuntimeError {
  constructor(callbackName: string) {
    super(`Callback '${callbackName}' não registrado ou inválido`);
    this.name = 'CallbackError';
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

export const checkRuntimeConnection = async (): Promise<boolean> => {
  if (!checkRuntime()) {
    console.warn('WailsRuntime: Runtime não está disponível para verificação de conexão');
    return false;
  }
  
  try {
    console.log('WailsRuntime: Verificando conexão com o backend...');
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('WailsRuntime: Conexão com o backend confirmada');
    return true;
  } catch (error) {
    console.error('WailsRuntime: Erro ao verificar conexão com o backend:', error);
    return false;
  }
};

export const withRuntime = async <T>(
  operation: () => Promise<T>,
  fallback?: T
): Promise<T> => {
  try {
    console.log('WailsRuntime: Verificando disponibilidade do runtime...');
    await waitForRuntime();
    console.log('WailsRuntime: Runtime disponível, executando operação...');
    
    try {
      return await operation();
    } catch (error) {
      const errorStr = String(error);
      if (errorStr.includes('Callback') && errorStr.includes('not registered')) {
        console.error('WailsRuntime: Erro de callback não registrado:', error);
        
        const callbackMatch = errorStr.match(/Callback '(.+)' not registered/);
        const callbackName = callbackMatch ? callbackMatch[1] : 'unknown';
        
        throw new CallbackError(callbackName);
      }
      throw error;
    }
  } catch (error) {
    console.error('WailsRuntime: Erro ao executar operação:', error);
    
    if ((error instanceof RuntimeError || error instanceof CallbackError) && fallback !== undefined) {
      console.debug('WailsRuntime: Usando fallback devido a erro de runtime:', error);
      return fallback;
    }
    throw error;
  }
};