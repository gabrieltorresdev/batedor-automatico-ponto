import { RetryStatus } from '@/lib/initializationQueue';

// Backend types
export interface SlackStatus {
    Emoji: string; // Can be a unicode emoji or an image URL
    Mensagem: string;
}

export interface SlackConfig {
    DiretorioConfig: string;
    ModoSilencioso: boolean;
}

// Frontend types
export interface Status {
    emoji: string;
    text: string;
}

// Message and operation types
export type TipoMensagem = 'entrada' | 'refeicao' | 'saida';
export type TipoOperacao = 'entrada' | 'almoco' | 'saida';

// Error types
export type SlackErrorType = 'auth' | 'network' | 'unknown';

export interface SlackError {
    type: SlackErrorType;
    message: string;
}

// Retry status for slack tasks
export interface SlackRetryStatus {
    status: RetryStatus | { isRetrying: boolean; retryAttempt: number; maxRetries: number; };
    message: RetryStatus | { isRetrying: boolean; retryAttempt: number; maxRetries: number; };
    isRetrying: boolean;
    active: RetryStatus | null;
}

// Constants for task keys
export const SLACK_TASK_KEYS = {
    STATUS: 'slack-status',
    MESSAGE: 'slack-message',
    VERIFICATION: 'slack-verification'
};

// Slack state interface
export interface SlackState {
    isAuthenticated: boolean;
    isInitialized: boolean;
    isLoading: boolean;
    error: SlackError | null;
    currentStatus: Status | null;
    
    // Methods
    initialize: () => Promise<void>;
    verifySlackSession: () => Promise<void>;
    getCurrentStatus: () => Promise<Status | null>;
    setStatus: (status: Status) => Promise<void>;
    clearStatus: () => Promise<void>;
    sendMessage: (message: string) => Promise<void>;
    getStatusPresets: () => Status[];
    getPresetMessages: (type: TipoMensagem) => string[];
    
    // State management
    setAuthenticated: () => void;
    setUnauthenticated: () => void;
    setInitialized: () => void;
    setLoading: (loading: boolean) => void;
    reset: () => void;
    clearError: () => void;
} 