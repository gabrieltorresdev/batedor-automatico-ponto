import { create } from 'zustand';
import { SlackState, Status, TipoMensagem } from './types';
import * as actions from './actions';

export const useSlackStore = create<SlackState>((set, get) => ({
    isAuthenticated: false,
    isInitialized: false,
    isLoading: false,
    error: null,
    currentStatus: null,
    
    initialize: async () => actions.initialize(set, get),
    
    verifySlackSession: async () => actions.verifySlackSession(set, get),
    
    getCurrentStatus: async () => actions.getCurrentStatus(set, get),
    
    setStatus: async (status: Status) => actions.setStatus(status, set, get),
    
    clearStatus: async () => actions.clearStatus(set, get),
    
    sendMessage: async (message: string) => actions.sendMessage(message, set, get),
    
    getStatusPresets: () => actions.getStatusPresets(),
    
    getPresetMessages: (type: TipoMensagem) => actions.getPresetMessages(type),
    
    setAuthenticated: () => set({
        isAuthenticated: true,
        isInitialized: true,
        isLoading: false,
        error: null
    }),
    
    setUnauthenticated: () => set({
        isAuthenticated: false,
        isInitialized: true,
        isLoading: false,
        error: {
            type: 'auth',
            message: 'Slack session expired'
        }
    }),
    
    setInitialized: () => set(state => ({
        ...state,
        isInitialized: true,
        isLoading: false
    })),
    
    setLoading: (loading: boolean) => set(state => ({
        ...state,
        isLoading: loading,
        error: loading ? null : state.error
    })),
    
    reset: () => set({
        isAuthenticated: false,
        isInitialized: false,
        isLoading: false,
        error: null,
        currentStatus: null
    }),
    
    clearError: () => set(state => ({
        ...state,
        error: null
    }))
}));