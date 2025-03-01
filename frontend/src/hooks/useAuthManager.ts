import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth/authStore';
import { useNotifyStore } from '@/store/notifyStore';
import { useRetryStatus } from '@/hooks/useRetryStatus';
import { AUTH_TASK_KEYS } from '@/store/auth/actions';
import { withRuntime } from '@/lib/wailsRuntime';
import { VerificarCredenciaisSalvas } from '../../wailsjs/go/main/App';
import { AuthError, AuthRetryStatus } from '@/store/auth/types';
import { RetryStatus } from '@/lib/initializationQueue';

/**
 * Enhanced hook for authentication management that provides additional functionality
 * beyond the basic auth store
 */
export const useAuthManager = () => {
  const hasInitialized = useRef(false);
  const navigate = useNavigate();
  const authStore = useAuthStore();
  const addNotification = useNotifyStore(state => state.addNotification);
  
  // Get retry status for all auth-related tasks
  const initializationRetryStatus = useRetryStatus(AUTH_TASK_KEYS.INITIALIZATION);
  const verificationRetryStatus = useRetryStatus(AUTH_TASK_KEYS.VERIFICATION);
  const loginRetryStatus = useRetryStatus(AUTH_TASK_KEYS.LOGIN);

  /**
   * Handles authentication errors in a consistent way
   */
  const handleError = useCallback((error: unknown) => {
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
  }, [addNotification]);

  /**
   * Verifies credentials without automatic navigation
   * Returns true if credentials are valid
   */
  const verifyCredentials = useCallback(async (): Promise<boolean> => {
    try {
      await authStore.initialize();
      return true;
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [authStore, handleError]);

  /**
   * Logs in with the provided credentials and navigates to dashboard on success
   */
  const login = useCallback(async (username: string, password: string): Promise<void> => {
    try {
      await authStore.login(username, password);
      // Only navigate if we're not already on the dashboard
      if (window.location.pathname !== '/dashboard') {
        navigate('/dashboard');
      }
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [authStore, navigate, handleError]);

  /**
   * Reinitializes the authentication module
   * Used when there's a blocked error or other authentication issues
   */
  const reinitializeAuth = useCallback(async (): Promise<void> => {
    try {
      addNotification("Tentando reconectar ao sistema...", "info");
      
      // Reset the auth state to force a complete reinitialization
      authStore.setLoading(true);
      authStore.clearError();
      
      // Force a complete reinitialization by calling the backend directly
      await withRuntime(() => VerificarCredenciaisSalvas());
      
      addNotification("Sistema reconectado!", "success");
    } catch (error) {
      console.debug('Erro ao reinicializar autenticação:', error);
      
      // Determine error type and message
      let errorType = 'runtime';
      let errorMessage = 'Erro ao reconectar ao sistema';
      
      // Extract error message from different error formats
      if (typeof error === 'object' && error !== null) {
        // Check for Wails runtime error format
        if ('error' in error && typeof (error as any).error === 'string') {
          errorMessage = (error as any).error;
        } else if ('message' in error) {
          // Standard Error object
          errorMessage = (error as Error).message.replace('erro ao fazer login: ', '');
        }
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      // Check for blocked error
      if (errorMessage.toLowerCase().includes('bloqueado') || 
          errorMessage.toLowerCase().includes('blocked') ||
          errorMessage.toLowerCase().includes('horário permitido')) {
        errorType = 'blocked';
      } else if (errorMessage.toLowerCase().includes('credenciais') || 
                errorMessage.toLowerCase().includes('auth')) {
        errorType = 'invalid_credentials';
      } else if (errorMessage.toLowerCase().includes('conexão') || 
                errorMessage.toLowerCase().includes('network')) {
        errorType = 'network';
      }
      
      // Update auth store with the error
      authStore.setUnauthenticated({
        type: errorType as any,
        message: errorMessage
      });
      
      addNotification(errorMessage, 'error');
    }
  }, [authStore, addNotification]);

  // Auto-initialize on mount, but only if not already on dashboard
  useEffect(() => {
    // Skip initialization if we're already on the dashboard page
    // This prevents circular navigation
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
    // Expose retry status
    retryStatus: {
      initialization: initializationRetryStatus || { isRetrying: false, retryAttempt: 0, maxRetries: 0 },
      verification: verificationRetryStatus || { isRetrying: false, retryAttempt: 0, maxRetries: 0 },
      login: loginRetryStatus || { isRetrying: false, retryAttempt: 0, maxRetries: 0 },
      // Helper to determine if any auth task is retrying
      isRetrying: !!(initializationRetryStatus?.isRetrying || 
                 verificationRetryStatus?.isRetrying || 
                 loginRetryStatus?.isRetrying),
      // Get the active retry status (the one that's currently retrying)
      active: initializationRetryStatus?.isRetrying ? initializationRetryStatus :
              verificationRetryStatus?.isRetrying ? verificationRetryStatus :
              loginRetryStatus?.isRetrying ? loginRetryStatus : null
    } as AuthRetryStatus
  };
}; 