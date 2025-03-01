import { useState, useEffect, useCallback, useMemo } from 'react';
import { MainMenuAction, MainMenuActionType } from '@/types/ponto';
import { DefaultMainMenuStrategy } from '@/services/DefaultMainMenuStrategy';
import { useNotifyStore } from '@/store/notifyStore';
import { useSlackStore } from '@/store/slack/slackStore';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error) || 'Erro desconhecido';

export const useMainMenu = () => {
  const [actions, setActions] = useState<MainMenuAction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const addNotification = useNotifyStore((state) => state.addNotification);
  const isSlackAuthenticated = useSlackStore((state) => state.isAuthenticated);

  const strategy = useMemo(() => new DefaultMainMenuStrategy(), []);

  const loadActions = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const menuActions = await strategy.getActions();
      setActions(menuActions);
    } catch (error) {
      addNotification(getErrorMessage(error) || 'Erro ao carregar ações', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [strategy, addNotification]);

  const executeAction = useCallback(
    async (type: MainMenuActionType): Promise<string | void> => {
      setIsLoading(true);
      try {
        return await strategy.executeAction(type);
      } catch (error) {
        addNotification(getErrorMessage(error) || 'Erro ao executar ação', 'error');
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [strategy, addNotification]
  );

  useEffect(() => {
    loadActions();
  }, [isSlackAuthenticated, loadActions]);

  return {
    actions,
    isLoading,
    executeAction,
    refreshActions: loadActions,
  };
};