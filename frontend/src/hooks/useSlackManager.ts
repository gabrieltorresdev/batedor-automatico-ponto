import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSlackStore } from '@/store/slack/slackStore';
import { useNotifyStore } from '@/store/notifyStore';
import { useRetryStatus } from '@/hooks/useRetryStatus';
import { SLACK_TASK_KEYS, SlackRetryStatus, Status, TipoMensagem } from '@/store/slack/types';
import { RetryStatus } from '@/lib/initializationQueue';

/**
 * Enhanced hook for Slack management that provides additional functionality
 * beyond the basic Slack store
 */
export const useSlackManager = () => {
  const hasInitialized = useRef(false);
  const navigate = useNavigate();
  const slackStore = useSlackStore();
  const addNotification = useNotifyStore(state => state.addNotification);
  
  // Get retry status for all slack-related tasks
  const statusRetryStatus = useRetryStatus(SLACK_TASK_KEYS.STATUS);
  const messageRetryStatus = useRetryStatus(SLACK_TASK_KEYS.MESSAGE);
  
  /**
   * Handles Slack errors in a consistent way
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
   * Initializes the Slack module
   */
  const initialize = useCallback(async (): Promise<void> => {
    try {
      await slackStore.initialize();
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [slackStore, handleError]);
  
  /**
   * Verifies the Slack session
   */
  const verifySlackSession = useCallback(async (): Promise<void> => {
    try {
      await slackStore.verifySlackSession();
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [slackStore, handleError]);
  
  /**
   * Gets the current Slack status
   */
  const getCurrentStatus = useCallback(async (): Promise<Status | null> => {
    try {
      return await slackStore.getCurrentStatus();
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [slackStore, handleError]);
  
  /**
   * Sets a new Slack status and navigates to dashboard on success
   */
  const setStatus = useCallback(async (status: Status): Promise<void> => {
    try {
      await slackStore.setStatus(status);
      addNotification('Status atualizado com sucesso!', 'success');
      
      // Navigate to dashboard after successful operation
      navigate('/dashboard');
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [slackStore, handleError, addNotification, navigate]);
  
  /**
   * Clears the current Slack status and navigates to dashboard on success
   */
  const clearStatus = useCallback(async (): Promise<void> => {
    try {
      await slackStore.clearStatus();
      addNotification('Status removido com sucesso!', 'success');
      
      // Navigate to dashboard after successful operation
      navigate('/dashboard');
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [slackStore, handleError, addNotification, navigate]);
  
  /**
   * Sends a message to Slack and navigates to dashboard on success
   */
  const sendMessage = useCallback(async (message: string): Promise<void> => {
    try {
      await slackStore.sendMessage(message);
      addNotification('Mensagem enviada com sucesso!', 'success');
      
      // Navigate to dashboard after successful operation
      navigate('/dashboard');
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [slackStore, handleError, addNotification, navigate]);
  
  /**
   * Gets predefined status options
   */
  const getStatusPresets = useCallback((): Status[] => {
    return slackStore.getStatusPresets();
  }, [slackStore]);
  
  /**
   * Gets preset messages by type
   */
  const getPresetMessages = useCallback((type: TipoMensagem): string[] => {
    return slackStore.getPresetMessages(type);
  }, [slackStore]);
  
  // Auto-initialize on mount
  useEffect(() => {
    if (hasInitialized.current) return;
    
    if (!slackStore.isInitialized && !slackStore.isLoading) {
      hasInitialized.current = true;
      initialize().catch(() => {
        hasInitialized.current = false;
      });
    } else if (slackStore.isInitialized && slackStore.isAuthenticated && !slackStore.currentStatus) {
      // If already initialized but no status, fetch it
      getCurrentStatus().catch(error => {
        console.debug('Error fetching current status:', error);
      });
    }
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
    // Expose retry status
    retryStatus: {
      status: statusRetryStatus || { isRetrying: false, retryAttempt: 0, maxRetries: 0 },
      message: messageRetryStatus || { isRetrying: false, retryAttempt: 0, maxRetries: 0 },
      // Helper to determine if any slack task is retrying
      isRetrying: !!(statusRetryStatus?.isRetrying || messageRetryStatus?.isRetrying),
      // Get the active retry status (the one that's currently retrying)
      active: statusRetryStatus?.isRetrying ? statusRetryStatus :
              messageRetryStatus?.isRetrying ? messageRetryStatus : null
    } as SlackRetryStatus
  };
}; 