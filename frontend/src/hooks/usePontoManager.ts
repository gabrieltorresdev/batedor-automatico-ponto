import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePontoStore } from '@/store/ponto/pontoStore';
import { useNotifyStore } from '@/store/notifyStore';
import { useRetryStatus } from '@/hooks/useRetryStatus';
import { PONTO_TASK_KEYS, Localizacao, TipoOperacao, PontoRetryStatus } from '@/store/ponto/types';
import { getOperacaoDisplay } from '@/store/ponto/actions';
import { RetryStatus } from '@/lib/initializationQueue';

/**
 * Enhanced hook for ponto management that provides additional functionality
 * beyond the basic ponto store
 */
export const usePontoManager = () => {
  const hasInitialized = useRef(false);
  const navigate = useNavigate();
  const pontoStore = usePontoStore();
  const addNotification = useNotifyStore(state => state.addNotification);
  
  // Get retry status for all ponto-related tasks
  const localizacaoRetryStatus = useRetryStatus(PONTO_TASK_KEYS.LOCALIZACAO);
  const operacoesRetryStatus = useRetryStatus(PONTO_TASK_KEYS.OPERACOES);
  const execucaoRetryStatus = useRetryStatus(PONTO_TASK_KEYS.EXECUCAO);
  
  /**
   * Handles ponto errors in a consistent way
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
   * Loads initial data (locations and operations)
   */
  const initialize = useCallback(async (): Promise<void> => {
    try {
      await pontoStore.initialize();
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [pontoStore, handleError]);
  
  /**
   * Gets the current location
   */
  const obterLocalizacaoAtual = useCallback(async (): Promise<string> => {
    try {
      return await pontoStore.obterLocalizacaoAtual();
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [pontoStore, handleError]);
  
  /**
   * Gets available locations
   */
  const obterLocalizacoesDisponiveis = useCallback(async (): Promise<Localizacao[]> => {
    try {
      return await pontoStore.obterLocalizacoesDisponiveis();
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [pontoStore, handleError]);
  
  /**
   * Selects a location and updates available operations
   */
  const selecionarLocalizacao = useCallback(async (localizacao: Localizacao): Promise<void> => {
    try {
      await pontoStore.selecionarLocalizacao(localizacao);
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [pontoStore, handleError]);
  
  /**
   * Gets available operations
   */
  const obterOperacoesDisponiveis = useCallback(async (): Promise<TipoOperacao[]> => {
    try {
      return await pontoStore.obterOperacoesDisponiveis();
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [pontoStore, handleError]);
  
  /**
   * Executes an operation and navigates to dashboard on success
   */
  const executarOperacao = useCallback(async (operacao: TipoOperacao | string | number): Promise<void> => {
    try {
      await pontoStore.executarOperacao(operacao);
      addNotification(`Operação ${getOperacaoDisplay(operacao)} realizada com sucesso!`, 'success');
      
      // Navigate to dashboard after successful operation
      navigate('/dashboard');
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [pontoStore, handleError, addNotification, navigate]);
  
  // Auto-initialize on mount
  useEffect(() => {
    if (hasInitialized.current) return;
    
    if (!pontoStore.isInitialized && !pontoStore.isLoading) {
      hasInitialized.current = true;
      initialize().catch(() => {
        hasInitialized.current = false;
      });
    }
  }, [pontoStore.isInitialized, pontoStore.isLoading, initialize]);
  
  return {
    ...pontoStore,
    initialize,
    obterLocalizacaoAtual,
    obterLocalizacoesDisponiveis,
    selecionarLocalizacao,
    obterOperacoesDisponiveis,
    executarOperacao,
    handleError,
    // Expose retry status
    retryStatus: {
      localizacao: localizacaoRetryStatus || { isRetrying: false, retryAttempt: 0, maxRetries: 0 },
      operacoes: operacoesRetryStatus || { isRetrying: false, retryAttempt: 0, maxRetries: 0 },
      execucao: execucaoRetryStatus || { isRetrying: false, retryAttempt: 0, maxRetries: 0 },
      // Helper to determine if any ponto task is retrying
      isRetrying: !!(localizacaoRetryStatus?.isRetrying || 
                 operacoesRetryStatus?.isRetrying || 
                 execucaoRetryStatus?.isRetrying),
      // Get the active retry status (the one that's currently retrying)
      active: localizacaoRetryStatus?.isRetrying ? localizacaoRetryStatus :
              operacoesRetryStatus?.isRetrying ? operacoesRetryStatus :
              execucaoRetryStatus?.isRetrying ? execucaoRetryStatus : null
    } as PontoRetryStatus
  };
};