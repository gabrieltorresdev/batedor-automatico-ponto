import { create } from 'zustand';
import { DeletarCredenciais } from '../../wailsjs/go/main/App';

interface AuthStore {
    isAuthenticated: boolean;
    isBlocked: boolean;
    username: string;
    setAuthenticated: (username: string) => void;
    setBlocked: (username: string) => void;
    setUnauthenticated: () => void;
    formatDisplayName: (username: string) => string;
    logout: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
    isAuthenticated: false,
    isBlocked: false,
    username: '',
    setAuthenticated: (username: string) => set({ isAuthenticated: true, isBlocked: false, username }),
    setBlocked: (username: string) => set({ isAuthenticated: true, isBlocked: true, username }),
    setUnauthenticated: () => set({ isAuthenticated: false, isBlocked: false, username: '' }),
    formatDisplayName: (username: string) => {
        const firstName = username.split('.')[0];
        return firstName.charAt(0).toUpperCase() + firstName.slice(1);
    },
    logout: async () => {
        try {
            await DeletarCredenciais();
        } finally {
            set({ isAuthenticated: false, isBlocked: false, username: '' });
        }
    }
})); 