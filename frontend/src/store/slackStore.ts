import { create } from 'zustand'
import { VerificarSessaoSlack } from '../../wailsjs/go/main/App'

interface SlackState {
    isInitialized: boolean
    isAuthenticated: boolean
    isLoading: boolean
    verifySlackSession: () => Promise<void>
}

export const useSlackStore = create<SlackState>((set) => ({
    isInitialized: false,
    isAuthenticated: false,
    isLoading: false,

    verifySlackSession: async () => {
        set({ isLoading: true });
        try {
            // Verifica a sessão existente - agora parte da inicialização paralela
            await VerificarSessaoSlack();
            set({ isAuthenticated: true, isInitialized: true });
        } catch (err) {
            // Não é um erro crítico, apenas indica que não há sessão válida
            // O backend tentará autenticar automaticamente se necessário
            set({ isAuthenticated: false, isInitialized: true });
            console.debug('Sessão do Slack não encontrada:', err);
            throw err; // Propaga o erro para ser tratado pelo useAuth
        } finally {
            set({ isLoading: false });
        }
    }
})); 