import { PontoErrorType } from './types';
import { RuntimeError } from '@/lib/wailsRuntime';

/**
 * Determines the type of ponto error based on the error object or message
 */
export const determineErrorType = (error: unknown): PontoErrorType => {
  if (error instanceof RuntimeError) {
    return 'runtime';
  }
  
  // Check if the error is a structured error with type and message
  if (typeof error === 'object' && error !== null) {
    // First check if it's a JSON string that needs parsing
    if (typeof (error as any).error === 'string') {
      try {
        // Try to parse the error message as JSON
        const errorObj = JSON.parse((error as any).error);
        if (errorObj && errorObj.type) {
          if (errorObj.type === 'blocked') return 'blocked';
          if (errorObj.type === 'network') return 'network';
          if (errorObj.type === 'invalid_operation') return 'invalid_operation';
        }
      } catch (e) {
        // Not a JSON string, continue with normal processing
      }
    }
    
    // Direct object with type property
    if ('type' in error) {
      const typedError = error as { type: string };
      if (typedError.type === 'blocked') return 'blocked';
      if (typedError.type === 'network') return 'network';
      if (typedError.type === 'invalid_operation') return 'invalid_operation';
    }
  }
  
  // Fallback to string content checking
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

/**
 * Extracts a human-readable error message from various error formats
 */
export const extractErrorMessage = (error: unknown): string => {
  if (typeof error === 'object' && error !== null) {
    // Check if it's a structured error response
    if (typeof (error as any).error === 'string') {
      try {
        const errorObj = JSON.parse((error as any).error);
        if (errorObj && errorObj.message) {
          return errorObj.message;
        }
      } catch (e) {
        // Not a JSON string
        return (error as any).error || String(error);
      }
    }
    
    // Direct object with message property
    if ('message' in error) {
      return (error as { message: string }).message;
    }
  }
  
  // Fallback to string conversion
  return error instanceof Error ? error.message : String(error);
};