import { SlackErrorType } from './types';
import { RuntimeError } from '@/lib/wailsRuntime';

export const determineErrorType = (error: unknown): SlackErrorType => {
  if (error instanceof RuntimeError) {
    return 'unknown';
  }

  if (typeof error === 'object' && error !== null) {
    if (typeof (error as any).error === 'string') {
      try {
        const errorObj = JSON.parse((error as any).error);
        if (errorObj && errorObj.type) {
          if (errorObj.type === 'auth') return 'auth';
          if (errorObj.type === 'network') return 'network';
        }
      } catch (e) {}
    }

    if ('type' in error) {
      const typedError = error as { type: string };
      if (typedError.type === 'auth') return 'auth';
      if (typedError.type === 'network') return 'network';
    }
  }

  const message = String(error).toLowerCase();
  if (message.includes('auth') || message.includes('unauthorized') || message.includes('não autorizado')) {
    return 'auth';
  }
  if (message.includes('conexão') || message.includes('network') || message.includes('timeout')) {
    return 'network';
  }
  return 'unknown';
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

export const normalizeEmoji = (emoji: string): string => {
  if (emoji.startsWith('/')) {
    return emoji;
  }
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
  return emoji;
};