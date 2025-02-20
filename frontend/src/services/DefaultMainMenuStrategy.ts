import { MainMenuAction, MainMenuActionType, MainMenuStrategy } from "@/types/ponto";
import { useNotifyStore } from "@/store/notifyStore";
import { useSlackStore } from "@/store/slackStore";

export class DefaultMainMenuStrategy implements MainMenuStrategy {
    private getSlackAvailability(): boolean {
        return useSlackStore.getState().isAuthenticated;
    }

    async getActions(): Promise<MainMenuAction[]> {
        const isSlackAvailable = this.getSlackAvailability();

        return [
            {
                type: 'ponto_slack',
                label: 'Marcar Ponto + Slack',
                description: 'Registra o ponto e atualiza status/mensagem no Slack',
                icon: '✨',
                isAvailable: isSlackAvailable,
                fixed: true,
            },
            {
                type: 'ponto',
                label: 'Marcar Ponto',
                description: 'Registra o ponto sem atualizar o Slack',
                icon: '🕒',
                isAvailable: true,
                fixed: false,
            },
            {
                type: 'slack_message',
                label: 'Enviar Mensagem',
                description: 'Envia uma mensagem no canal do Slack',
                icon: '💬',
                isAvailable: isSlackAvailable,
                fixed: false,
            },
        ];
    }

    async executeAction(type: MainMenuActionType): Promise<string | void> {
        const addNotification = useNotifyStore.getState().addNotification;
        const { isAuthenticated } = useSlackStore.getState();

        if (!isAuthenticated && this.requiresSlack(type)) {
            addNotification('Configure o Slack primeiro', 'warning');
            return;
        }

        try {
            return await this.executeActionHandler(type);
        } catch (error) {
            addNotification((error as Error).message || 'Erro ao executar ação', 'error');
            throw error;
        }
    }

    private requiresSlack(type: MainMenuActionType): boolean {
        return ['ponto_slack', 'slack_message', 'slack_status'].includes(type);
    }

    private async executeActionHandler(type: MainMenuActionType): Promise<string | void> {
        switch (type) {
            case 'ponto_slack':
                return '/ponto/slack';
            
            case 'ponto':
                return '/ponto';
            
            case 'slack_message':
                return '/slack/message';
            
            case 'slack_status':
                return '/slack/status';
            
            default:
                throw new Error('Ação não implementada');
        }
    }
} 