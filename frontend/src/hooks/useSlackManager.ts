import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSlackStore } from '@/store/slack/slackStore';
import { useNotifyStore } from '@/store/notifyStore';
import { useRetryStatus } from '@/hooks/useRetryStatus';
import { SLACK_TASK_KEYS, SlackRetryStatus, Status, TipoMensagem } from '@/store/slack/types';

export const useSlackManager = () => {
  const hasInitialized = useRef(false);
  const navigate = useNavigate();
  const slackStore = useSlackStore();
  const addNotification = useNotifyStore(state => state.addNotification);
  
  const statusRetryStatus = useRetryStatus(SLACK_TASK_KEYS.STATUS, 'slack');
  const messageRetryStatus = useRetryStatus(SLACK_TASK_KEYS.MESSAGE, 'slack');
  
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
      await slackStore.initialize();
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [slackStore, handleError]);
  
  const verifySlackSession = useCallback(async (): Promise<void> => {
    try {
      await slackStore.verifySlackSession();
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [slackStore, handleError]);
  
  const getCurrentStatus = useCallback(async (): Promise<Status | null> => {
    try {
      return await slackStore.getCurrentStatus();
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [slackStore, handleError]);
  
  const setStatus = useCallback(async (status: Status): Promise<void> => {
    try {
      await slackStore.setStatus(status);
      addNotification('Status atualizado com sucesso!', 'success');
      
      navigate('/dashboard');
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [slackStore, handleError, addNotification, navigate]);
  
  const clearStatus = useCallback(async (): Promise<void> => {
    try {
      await slackStore.clearStatus();
      addNotification('Status removido com sucesso!', 'success');
      
      navigate('/dashboard');
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [slackStore, handleError, addNotification, navigate]);
  
  const sendMessage = useCallback(async (message: string): Promise<void> => {
    try {
      await slackStore.sendMessage(message);
      addNotification('Mensagem enviada com sucesso!', 'success');
      
      navigate('/dashboard');
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [slackStore, handleError, addNotification, navigate]);
  
  const getStatusPresets = useCallback((): Status[] => {
    return slackStore.getStatusPresets();
  }, [slackStore]);
  
  const getPresetMessages = useCallback((type: TipoMensagem): string[] => {
    return slackStore.getPresetMessages(type);
  }, [slackStore]);
  
  useEffect(() => {
    if (hasInitialized.current) return;
    
    if (!slackStore.isInitialized && !slackStore.isLoading) {
      console.log("SlackManager: Starting initialization");
      hasInitialized.current = true;
      
      const timeoutId = setTimeout(() => {
        initialize().catch((error) => {
          console.error("SlackManager: Initialization failed", error);
          hasInitialized.current = false;
        });
      }, 200);
      
      return () => {
        clearTimeout(timeoutId);
      };
    } else if (slackStore.isInitialized && slackStore.isAuthenticated && !slackStore.currentStatus) {
      getCurrentStatus().catch(error => {
        console.debug('Error fetching current status:', error);
      });
    }
    
    return () => {};
  }, [slackStore.isInitialized, slackStore.isLoading, slackStore.isAuthenticated, slackStore.currentStatus, initialize, getCurrentStatus]);
  
  return {
    ...slackStore,
    initialize,
    verifySlackSession,
    getCurrentStatus,
    setStatus,
    clearStatus,
    sendMessage,
    getStatusPresets,
    getPresetMessages,
    handleError,
    retryStatus: {
      status: statusRetryStatus || { isRetrying: false, retryAttempt: 0, maxRetries: 0 },
      message: messageRetryStatus || { isRetrying: false, retryAttempt: 0, maxRetries: 0 },
      isRetrying: !!(statusRetryStatus?.isRetrying || messageRetryStatus?.isRetrying),
      active: statusRetryStatus?.isRetrying ? statusRetryStatus :
              messageRetryStatus?.isRetrying ? messageRetryStatus : null
    } as SlackRetryStatus
  };
};