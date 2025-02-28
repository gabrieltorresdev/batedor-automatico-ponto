import { create } from 'zustand'
import { VerificarSessaoSlack } from '../../wailsjs/go/main/App'

export type SlackErrorType = 'auth' | 'network' | 'unknown';

interface SlackError {
    type: SlackErrorType;
    message: string;
}

interface SlackState {
    isAuthenticated: boolean;
    isInitialized: boolean;
    isLoading: boolean;
    error: SlackError | null;
    verificationPromise: Promise<void> | null;
    lastVerificationAttempt: number;
    verifySlackSession: () => Promise<void>;
    setAuthenticated: () => void;
    setUnauthenticated: () => void;
    setInitialized: () => void;
    setLoading: (loading: boolean) => void;
    reset: () => void;
    clearError: () => void;
}

const VERIFICATION_COOLDOWN = 2000; // 2 seconds cooldown between attempts

export const useSlackStore = create<SlackState>((set, get) => ({
    isAuthenticated: false,
    isInitialized: false,
    isLoading: false,
    error: null,
    verificationPromise: null,
    lastVerificationAttempt: 0,
    
    verifySlackSession: async () => {
        const state = get();
        
        // If already initialized or verification in progress, return existing promise
        if (state.isInitialized) {
            return Promise.resolve();
        }
        
        if (state.verificationPromise) {
            return state.verificationPromise;
        }
        
        // Check cooldown
        const now = Date.now();
        if (now - state.lastVerificationAttempt < VERIFICATION_COOLDOWN) {
            return Promise.resolve();
        }
        
        try {
            set({ 
                isLoading: true,
                error: null,
                lastVerificationAttempt: now
            });
            
            // Create new verification promise
            const promise = (async () => {
                try {
                    await VerificarSessaoSlack();
                    set({ 
                        isAuthenticated: true, 
                        isInitialized: true, 
                        isLoading: false,
                        error: null,
                        verificationPromise: null
                    });
                } catch (error) {
                    const errorMessage = (error as Error).message || 'Unknown error';
                    let errorType: SlackErrorType = 'unknown';
                    
                    if (errorMessage.includes('auth') || errorMessage.includes('unauthorized')) {
                        errorType = 'auth';
                    } else if (errorMessage.includes('network') || errorMessage.includes('conexão')) {
                        errorType = 'network';
                    }
                    
                    set({ 
                        isAuthenticated: false, 
                        isInitialized: true, 
                        isLoading: false,
                        verificationPromise: null,
                        error: {
                            type: errorType,
                            message: errorMessage
                        }
                    });
                    throw error;
                }
            })();
            
            set({ verificationPromise: promise });
            return promise;
        } catch (error) {
            set({ 
                isLoading: false,
                verificationPromise: null
            });
            throw error;
        }
    },
    
    setAuthenticated: () => set({
        isAuthenticated: true,
        isInitialized: true,
        isLoading: false,
        error: null,
        verificationPromise: null
    }),
    
    setUnauthenticated: () => set({
        isAuthenticated: false,
        isInitialized: true,
        isLoading: false,
        verificationPromise: null,
        error: {
            type: 'auth',
            message: 'Slack session expired'
        }
    }),
    
    setInitialized: () => set(state => ({
        ...state,
        isInitialized: true,
        isLoading: false,
        verificationPromise: null
    })),
    
    setLoading: (loading) => set(state => ({
        ...state,
        isLoading: loading,
        error: loading ? null : state.error
    })),
    
    reset: () => set({
        isAuthenticated: false,
        isInitialized: false,
        isLoading: false,
        error: null,
        verificationPromise: null,
        lastVerificationAttempt: 0
    }),
    
    clearError: () => set(state => ({
        ...state,
        error: null
    }))
})); 