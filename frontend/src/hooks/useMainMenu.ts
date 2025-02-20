import { useEffect, useState } from 'react';
import { MainMenuAction, MainMenuActionType } from '@/types/ponto';
import { DefaultMainMenuStrategy } from '@/services/DefaultMainMenuStrategy';
import { useNotifyStore } from '@/store/notifyStore';

export const useMainMenu = () => {
    const [actions, setActions] = useState<MainMenuAction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const addNotification = useNotifyStore((state) => state.addNotification);

    const strategy = new DefaultMainMenuStrategy();

    const loadActions = async () => {
        try {
            setIsLoading(true);
            const menuActions = await strategy.getActions();
            setActions(menuActions);
        } catch (err) {
            addNotification((err as Error).message || 'Erro ao carregar ações', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const executeAction = async (type: MainMenuActionType): Promise<string | void> => {
        try {
            setIsLoading(true);
            return await strategy.executeAction(type);
        } catch (err) {
            addNotification((err as Error).message || 'Erro ao executar ação', 'error');
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadActions();
    }, []);

    return {
        actions,
        isLoading,
        executeAction,
        refreshActions: loadActions
    };
}; 