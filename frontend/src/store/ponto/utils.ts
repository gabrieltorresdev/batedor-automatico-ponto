import { PontoErrorType } from './types';
import { RuntimeError } from '@/lib/wailsRuntime';

export const determineErrorType = (error: unknown): PontoErrorType => {
  if (error instanceof RuntimeError) {
    return 'runtime';
  }
  
  if (typeof error === 'object' && error !== null) {
    if (typeof (error as any).error === 'string') {
      try {
        const errorObj = JSON.parse((error as any).error);
        if (errorObj && errorObj.type) {
          if (errorObj.type === 'blocked') return 'blocked';
          if (errorObj.type === 'network') return 'network';
          if (errorObj.type === 'invalid_operation') return 'invalid_operation';
        }
      } catch (e) {}
    }
    
    if ('type' in error) {
      const typedError = error as { type: string };
      if (typedError.type === 'blocked') return 'blocked';
      if (typedError.type === 'network') return 'network';
      if (typedError.type === 'invalid_operation') return 'invalid_operation';
    }
  }
  
  const message = String(error).toLowerCase();
  if (message.includes('bloqueado') || message.includes('horário permitido')) {
    return 'blocked';
  }
  if (message.includes('conexão') || message.includes('network')) {
    return 'network';
  }
  if (message.includes('operação inválida') || message.includes('invalid operation')) {
    return 'invalid_operation';
  }
  return 'runtime';
};

export const extractErrorMessage = (error: unknown): string => {
  if (typeof error === 'object' && error !== null) {
    if (typeof (error as any).error === 'string') {
      try {
        const errorObj = JSON.parse((error as any).error);
        if (errorObj && errorObj.message) {
          return errorObj.message;
        }
      } catch (e) {
        return (error as any).error || String(error);
      }
    }
    
    if ('message' in error) {
      return (error as { message: string }).message;
    }
  }
  
  return error instanceof Error ? error.message : String(error);
};