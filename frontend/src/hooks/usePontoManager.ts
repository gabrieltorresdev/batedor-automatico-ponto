import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePontoStore } from '@/store/ponto/pontoStore';
import { useNotifyStore } from '@/store/notifyStore';
import { useRetryStatus } from '@/hooks/useRetryStatus';
import { PONTO_TASK_KEYS, Localizacao, TipoOperacao, PontoRetryStatus } from '@/store/ponto/types';
import { getOperacaoDisplay } from '@/store/ponto/actions';

export const usePontoManager = () => {
  const hasInitialized = useRef(false);
  const navigate = useNavigate();
  const pontoStore = usePontoStore();
  const addNotification = useNotifyStore(state => state.addNotification);
  
  const localizacaoRetryStatus = useRetryStatus(PONTO_TASK_KEYS.LOCALIZACAO, 'ponto');
  const operacoesRetryStatus = useRetryStatus(PONTO_TASK_KEYS.OPERACOES, 'ponto');
  const execucaoRetryStatus = useRetryStatus(PONTO_TASK_KEYS.EXECUCAO, 'ponto');
  
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
  
  const initialize = useCallback(async (): Promise<void> => {
    try {
      await pontoStore.initialize();
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [pontoStore, handleError]);
  
  const obterLocalizacaoAtual = useCallback(async (): Promise<string> => {
    try {
      return await pontoStore.obterLocalizacaoAtual();
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [pontoStore, handleError]);
  
  const obterLocalizacoesDisponiveis = useCallback(async (): Promise<Localizacao[]> => {
    try {
      return await pontoStore.obterLocalizacoesDisponiveis();
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [pontoStore, handleError]);
  
  const selecionarLocalizacao = useCallback(async (localizacao: Localizacao): Promise<void> => {
    try {
      await pontoStore.selecionarLocalizacao(localizacao);
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [pontoStore, handleError]);
  
  const obterOperacoesDisponiveis = useCallback(async (): Promise<TipoOperacao[]> => {
    try {
      return await pontoStore.obterOperacoesDisponiveis();
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [pontoStore, handleError]);
  
  const executarOperacao = useCallback(async (operacao: TipoOperacao | string | number): Promise<void> => {
    try {
      await pontoStore.executarOperacao(operacao);
      addNotification(`Operação ${getOperacaoDisplay(operacao)} realizada com sucesso!`, 'success');
      
      navigate('/dashboard');
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [pontoStore, handleError, addNotification, navigate]);
  
  useEffect(() => {
    if (hasInitialized.current) return;
    
    if (!pontoStore.isInitialized && !pontoStore.isLoading) {
      console.log("PontoManager: Starting initialization");
      hasInitialized.current = true;
      
      const timeoutId = setTimeout(() => {
        initialize().catch((error) => {
          console.error("PontoManager: Initialization failed", error);
          hasInitialized.current = false;
        });
      }, 100);
      
      return () => {
        clearTimeout(timeoutId);
      };
    }
    
    return () => {
    };
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
    retryStatus: {
      localizacao: localizacaoRetryStatus || { isRetrying: false, retryAttempt: 0, maxRetries: 0 },
      operacoes: operacoesRetryStatus || { isRetrying: false, retryAttempt: 0, maxRetries: 0 },
      execucao: execucaoRetryStatus || { isRetrying: false, retryAttempt: 0, maxRetries: 0 },
      isRetrying: !!(localizacaoRetryStatus?.isRetrying || 
                 operacoesRetryStatus?.isRetrying || 
                 execucaoRetryStatus?.isRetrying),
      active: localizacaoRetryStatus?.isRetrying ? localizacaoRetryStatus :
              operacoesRetryStatus?.isRetrying ? operacoesRetryStatus :
              execucaoRetryStatus?.isRetrying ? execucaoRetryStatus : null
    } as PontoRetryStatus
  };
};