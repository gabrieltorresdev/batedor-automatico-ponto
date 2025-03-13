import { RetryStatus } from '@/lib/initializationQueue';

export interface SlackStatus {
    Emoji: string;
    Mensagem: string;
}

export interface SlackConfig {
    DiretorioConfig: string;
    ModoSilencioso: boolean;
}

export interface Status {
    emoji: string;
    text: string;
}

export type TipoMensagem = 'entrada' | 'refeicao' | 'saida';
export type TipoOperacao = 'entrada' | 'almoco' | 'saida';

export type SlackErrorType = 'auth' | 'network' | 'unknown';

export interface SlackError {
    type: SlackErrorType;
    message: string;
}

export interface SlackRetryStatus {
    status: RetryStatus | { isRetrying: boolean; retryAttempt: number; maxRetries: number; };
    message: RetryStatus | { isRetrying: boolean; retryAttempt: number; maxRetries: number; };
    isRetrying: boolean;
    active: RetryStatus | null;
}

export const SLACK_TASK_KEYS = {
    STATUS: 'slack-status',
    MESSAGE: 'slack-message',
    VERIFICATION: 'slack-verification'
};

export interface SlackState {
    isAuthenticated: boolean;
    isInitialized: boolean;
    isLoading: boolean;
    error: SlackError | null;
    currentStatus: Status | null;
    initialize: () => Promise<void>;
    verifySlackSession: () => Promise<void>;
    getCurrentStatus: () => Promise<Status | null>;
    setStatus: (status: Status) => Promise<void>;
    clearStatus: () => Promise<void>;
    sendMessage: (message: string) => Promise<void>;
    getStatusPresets: () => Status[];
    getPresetMessages: (type: TipoMensagem) => string[];
    setAuthenticated: () => void;
    setUnauthenticated: () => void;
    setInitialized: () => void;
    setLoading: (loading: boolean) => void;
    reset: () => void;
    clearError: () => void;
}