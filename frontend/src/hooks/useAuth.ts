import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useNotifyStore } from '@/store/notifyStore';
import { useSlackStore } from '@/store/slackStore';
import { initializationQueue } from '@/lib/initializationQueue';
import { RuntimeError } from '@/lib/wailsRuntime';

interface UseAuthReturn {
  login: (username: string, password: string) => Promise<void>;
  isLoading: boolean;
  verifyCredentials: () => Promise<void>;
}

export const useAuth = (): UseAuthReturn => {
  const hasInitialized = useRef(false);
  const navigate = useNavigate();
  const authStore = useAuthStore();
  const slackStore = useSlackStore();
  const addNotification = useNotifyStore(state => state.addNotification);

  const verifySlack = async (): Promise<void> => {
    if (slackStore.isInitialized || slackStore.isLoading) return;
    await initializationQueue.enqueue(async () => {
      await slackStore.verifySlackSession();
    }, 'slack-verification');
  };

  const handleError = (error: unknown) => {
    if (error instanceof RuntimeError) {
      addNotification('Sistema indisponível. Tente novamente em instantes.', 'error');
      return;
    }

    // Handle structured error response
    if (typeof error === 'object' && error !== null) {
      // Check if it's a JSON string in the error property
      if (typeof (error as any).error === 'string') {
        try {
          // Try to parse the error message as JSON
          const errorObj = JSON.parse((error as any).error);
          if (errorObj && errorObj.message) {
            addNotification(errorObj.message, 'error');
            return;
          }
        } catch (e) {
          // Not a JSON string, use the error property directly
          addNotification((error as any).error, 'error');
          return;
        }
      }
      
      // Direct object with message property
      if ('message' in error) {
        addNotification((error as { message: string }).message, 'error');
        return;
      }
    }

    // If it's a string, show it directly
    if (typeof error === 'string') {
      addNotification(error, 'error');
      return;
    }

    // Error instance
    if (error instanceof Error) {
      addNotification(error.message, 'error');
      return;
    }

    // Last fallback for truly unknown errors
    addNotification('Erro desconhecido. Tente novamente.', 'error');
  };

  const verifyCredentials = async (): Promise<void> => {
    await initializationQueue.enqueue(async () => {
      try {
        await authStore.initialize();
        navigate('/dashboard');
        await verifySlack();
      } catch (error) {
        handleError(error);
        throw error;
      }
    }, 'auth-verification');
  };

  const login = async (username: string, password: string): Promise<void> => {
    await initializationQueue.enqueue(async () => {
      try {
        await authStore.login(username, password);
        navigate('/dashboard');
        await verifySlack();
      } catch (error) {
        handleError(error);
        throw error;
      }
    }, 'login');
  };

  useEffect(() => {
    if (hasInitialized.current) return;

    if (!authStore.isInitialized && !authStore.isLoading) {
      hasInitialized.current = true;
      verifyCredentials().catch(() => {
        hasInitialized.current = false;
      });
    }
  }, [authStore.isInitialized, authStore.isLoading]);

  return {
    login,
    isLoading: authStore.isLoading || slackStore.isLoading,
    verifyCredentials
  };
};