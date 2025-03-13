import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth/authStore';
import { useNotifyStore } from '@/store/notifyStore';
import { useRetryStatus } from '@/hooks/useRetryStatus';
import { AUTH_TASK_KEYS } from '@/store/auth/actions';
import { withRuntime } from '@/lib/wailsRuntime';
import { VerificarCredenciaisSalvas } from '../../wailsjs/go/main/App';
import { AuthRetryStatus } from '@/store/auth/types';

export const useAuthManager = () => {
  const hasInitialized = useRef(false);
  const navigate = useNavigate();
  const authStore = useAuthStore();
  const addNotification = useNotifyStore(state => state.addNotification);
  
  const initializationRetryStatus = useRetryStatus(AUTH_TASK_KEYS.INITIALIZATION, 'auth');
  const verificationRetryStatus = useRetryStatus(AUTH_TASK_KEYS.VERIFICATION, 'auth');
  const loginRetryStatus = useRetryStatus(AUTH_TASK_KEYS.LOGIN, 'auth');

  const handleError = useCallback((error: unknown) => {
    if (typeof error === 'object' && error !== null) {
      if (typeof (error as any).error === 'string') {
        try {
          const errorObj = JSON.parse((error as any).error);
          if (errorObj && errorObj.message) {
            addNotification(errorObj.message, 'error');
            return;
          }
        } catch (e) {
          addNotification((error as any).error, 'error');
          return;
        }
      }
      
      if ('message' in error) {
        addNotification((error as { message: string }).message, 'error');
        return;
      }
    }

    if (typeof error === 'string') {
      addNotification(error, 'error');
      return;
    }

    if (error instanceof Error) {
      addNotification(error.message, 'error');
      return;
    }

    addNotification('Erro desconhecido. Tente novamente.', 'error');
  }, [addNotification]);

  const verifyCredentials = useCallback(async (): Promise<boolean> => {
    try {
      await authStore.initialize();
      return true;
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [authStore, handleError]);

  const login = useCallback(async (username: string, password: string): Promise<void> => {
    try {
      await authStore.login(username, password);
      if (window.location.pathname !== '/dashboard') {
        navigate('/dashboard');
      }
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [authStore, navigate, handleError]);

  const reinitializeAuth = useCallback(async (): Promise<void> => {
    try {
      addNotification("Tentando reconectar ao sistema...", "info");
      
      authStore.setLoading(true);
      authStore.clearError();
      
      await withRuntime(() => VerificarCredenciaisSalvas());
      
      addNotification("Sistema reconectado!", "success");
    } catch (error) {
      console.debug('Erro ao reinicializar autenticação:', error);
      
      let errorMessage = 'Erro ao reconectar ao sistema';
      
      if (typeof error === 'object' && error !== null) {
        if ('error' in error && typeof (error as any).error === 'string') {
          errorMessage = (error as any).error;
        } else if ('message' in error) {
          errorMessage = (error as Error).message;
        }
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      authStore.setUnauthenticated({
        type: 'blocked',
        message: errorMessage
      });
      
      addNotification(errorMessage, 'error');
    }
  }, [authStore, addNotification]);

  useEffect(() => {
    if (hasInitialized.current || window.location.pathname === '/dashboard') return;

    if (!authStore.isInitialized && !authStore.isLoading) {
      hasInitialized.current = true;
      verifyCredentials().catch(() => {
        hasInitialized.current = false;
      });
    }
  }, [authStore.isInitialized, authStore.isLoading, verifyCredentials]);

  return {
    ...authStore,
    login,
    verifyCredentials,
    reinitializeAuth,
    handleError,
    retryStatus: {
      initialization: initializationRetryStatus || { isRetrying: false, retryAttempt: 0, maxRetries: 0 },
      verification: verificationRetryStatus || { isRetrying: false, retryAttempt: 0, maxRetries: 0 },
      login: loginRetryStatus || { isRetrying: false, retryAttempt: 0, maxRetries: 0 },
      isRetrying: !!(initializationRetryStatus?.isRetrying || 
                 verificationRetryStatus?.isRetrying || 
                 loginRetryStatus?.isRetrying),
      active: initializationRetryStatus?.isRetrying ? initializationRetryStatus :
              verificationRetryStatus?.isRetrying ? verificationRetryStatus :
              loginRetryStatus?.isRetrying ? loginRetryStatus : null
    } as AuthRetryStatus
  };
};