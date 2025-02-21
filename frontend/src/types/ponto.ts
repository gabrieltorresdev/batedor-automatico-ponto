import { ReactNode } from 'react';

// Tipos de ações do menu principal
export type MainMenuActionType = 
    | 'ponto_slack'     // Marcar ponto + Slack
    | 'ponto'          // Somente marcar ponto
    | 'slack_message'  // Enviar mensagem no Slack
    | 'slack_status';   // Alterar status no Slack

// Interface para ações do menu principal
export interface MainMenuAction {
    type: MainMenuActionType;
    label: string;
    description: string;
    icon: ReactNode;
    isAvailable: boolean;
    fixed: boolean;
}

// Strategy para o menu principal
export interface MainMenuStrategy {
    getActions: () => Promise<MainMenuAction[]>;
    executeAction: (type: MainMenuActionType) => Promise<string | void>;
}