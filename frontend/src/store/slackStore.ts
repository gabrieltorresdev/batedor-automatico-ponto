import { create } from 'zustand'
import { InicializarSlack, VerificarSessaoSlack } from '../../wailsjs/go/main/App'

interface SlackState {
    isInitialized: boolean
    isAuthenticated: boolean
    isLoading: boolean
    verifySlackSession: () => Promise<void>
    configureSlack: () => Promise<void>
}

export const useSlackStore = create<SlackState>((set) => ({
    isInitialized: false,
    isAuthenticated: false,
    isLoading: false,

    verifySlackSession: async () => {
        set({ isLoading: true });
        try {
            // Apenas verifica a sessão existente
            await VerificarSessaoSlack();
            set({ isAuthenticated: true, isInitialized: true });
        } catch (err) {
            // Não é um erro crítico, apenas indica que não há sessão válida
            set({ isAuthenticated: false, isInitialized: true });
            console.debug('Sessão do Slack não encontrada:', err);
        } finally {
            set({ isLoading: false });
        }
    },

    configureSlack: async () => {
        set({ isLoading: true });
        try {
            // Inicia processo de configuração interativa
            await InicializarSlack();
            // Após configuração, verifica se a sessão está válida
            set({ isAuthenticated: true, isInitialized: true });
        } catch (err) {
            set({ isAuthenticated: false });
            console.error('Erro ao configurar Slack:', err);
            throw err;
        } finally {
            set({ isLoading: false });
        }
    }
})); 