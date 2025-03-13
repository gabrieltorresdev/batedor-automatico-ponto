import { ReactNode } from 'react';

export type MainMenuActionType = 
    | 'ponto_slack'
    | 'ponto'
    | 'slack_message'
    | 'slack_status';

export interface MainMenuAction {
    type: MainMenuActionType;
    label: string;
    description: string;
    icon: ReactNode;
    isAvailable: boolean;
    fixed: boolean;
}

export interface MainMenuStrategy {
    getActions: () => Promise<MainMenuAction[]>;
    executeAction: (type: MainMenuActionType) => Promise<string | void>;
}