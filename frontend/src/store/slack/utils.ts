import { SlackErrorType } from './types';
import { RuntimeError } from '@/lib/wailsRuntime';

/**
 * Determines the type of slack error based on the error object or message
 */
export const determineErrorType = (error: unknown): SlackErrorType => {
  if (error instanceof RuntimeError) {
    return 'unknown';
  }
  
  // Check if the error is a structured error with type and message
  if (typeof error === 'object' && error !== null) {
    // First check if it's a JSON string that needs parsing
    if (typeof (error as any).error === 'string') {
      try {
        // Try to parse the error message as JSON
        const errorObj = JSON.parse((error as any).error);
        if (errorObj && errorObj.type) {
          if (errorObj.type === 'auth') return 'auth';
          if (errorObj.type === 'network') return 'network';
        }
      } catch (e) {
        // Not a JSON string, continue with normal processing
      }
    }
    
    // Direct object with type property
    if ('type' in error) {
      const typedError = error as { type: string };
      if (typedError.type === 'auth') return 'auth';
      if (typedError.type === 'network') return 'network';
    }
  }
  
  // Fallback to string content checking
  const message = String(error).toLowerCase();
  if (message.includes('auth') || message.includes('unauthorized') || message.includes('não autorizado')) {
    return 'auth';
  }
  if (message.includes('conexão') || message.includes('network') || message.includes('timeout')) {
    return 'network';
  }
  return 'unknown';
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

/**
 * Normalizes emoji string to display format
 */
export const normalizeEmoji = (emoji: string): string => {
  // If emoji is an image URL (starts with /)
  if (emoji.startsWith('/')) {
    return emoji;
  }
  // If emoji starts with : and ends with :, extract the real emoji
  if (emoji.startsWith(':') && emoji.endsWith(':')) {
    const emojiMap: Record<string, string> = {
      ':cama:': '🛏️',
      ':bed:': '🛏️',
      ':casa_com_jardim:': '🏡',
      ':house_with_garden:': '🏡',
      ':café:': '☕',
      ':coffee:': '☕',
      ':prato_garfo_faca:': '🍽️',
      ':knife_fork_plate:': '🍽️',
      ':ot:': '/src/assets/images/ot.png'
    };
    return emojiMap[emoji.toLowerCase()] || emoji;
  }
  // If it's a unicode emoji
  return emoji;
}; 