import { create } from 'zustand';
import { SlackState, Status, TipoMensagem } from './types';
import * as actions from './actions';

/**
 * Slack store that manages Slack status and messages
 */
export const useSlackStore = create<SlackState>((set, get) => ({
    isAuthenticated: false,
    isInitialized: false,
    isLoading: false,
    error: null,
    currentStatus: null,
    
    // Initialize the slack module
    initialize: async () => actions.initialize(set, get),
    
    // Verify slack session
    verifySlackSession: async () => actions.verifySlackSession(set, get),
    
    // Get current status
    getCurrentStatus: async () => actions.getCurrentStatus(set, get),
    
    // Set status
    setStatus: async (status: Status) => actions.setStatus(status, set, get),
    
    // Clear status
    clearStatus: async () => actions.clearStatus(set, get),
    
    // Send message
    sendMessage: async (message: string) => actions.sendMessage(message, set, get),
    
    // Get status presets
    getStatusPresets: () => actions.getStatusPresets(),
    
    // Get preset messages
    getPresetMessages: (type: TipoMensagem) => actions.getPresetMessages(type),
    
    // State management
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