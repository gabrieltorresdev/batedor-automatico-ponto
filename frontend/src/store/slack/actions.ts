import { ObterStatusAtual, DefinirStatus, LimparStatus, EnviarMensagem, VerificarSessaoSlack } from '../../../wailsjs/go/main/App';
import { withRuntime } from '@/lib/wailsRuntime';
import { initializationQueue } from '@/lib/initializationQueue';
import { SlackState, Status, TipoMensagem, TipoOperacao, SLACK_TASK_KEYS, SlackStatus } from './types';
import { determineErrorType, extractErrorMessage } from './utils';
import otLogo from '@/assets/images/ot.png';

// Predefined status constants
export const StatusTrabalhoPresencial: Status = {
    emoji: otLogo,
    text: 'Trabalhando Presencialmente'
};

export const StatusHomeOffice: Status = {
    emoji: '🏡',
    text: 'Trabalhando remotamente'
};

export const StatusAlmoco: Status = {
    emoji: '🍽️',
    text: 'Almoçando'
};

export const StatusFimExpediente: Status = {
    emoji: '🛏️',
    text: 'Fora do Expediente'
};

// Helper function to normalize location
export const normalizeLocation = (location: string): string => {
    const loc = location.toUpperCase().trim();
    if (loc === 'HOME OFFICE' || loc.includes('HOME')) return 'HOME OFFICE';
    if (loc === 'ESCRITÓRIO' || loc.includes('ESCRIT')) return 'ESCRITÓRIO';
    return loc;
};

/**
 * Initializes the Slack module by verifying the session
 */
export const initialize = async (
    set: (state: Partial<SlackState>) => void,
    get: () => SlackState
): Promise<void> => {
    const state = get();
    if (state.isInitialized || state.isLoading) return;

    try {
        // First verify the session
        await verifySlackSession(set, get);
        
        // Then fetch the current status if authenticated
        if (get().isAuthenticated) {
            await getCurrentStatus(set, get);
        }
    } catch (error) {
        // If verification fails, the error is already handled in verifySlackSession
        console.debug('Error during Slack initialization:', error);
    }
};

/**
 * Verifies the Slack session with the backend
 */
export const verifySlackSession = async (
    set: (state: Partial<SlackState>) => void,
    get: () => SlackState
): Promise<void> => {
    const state = get();
    if (state.isLoading) return;

    return initializationQueue.enqueue(async () => {
        try {
            set({ isLoading: true, error: null });
            await withRuntime(() => VerificarSessaoSlack());
            
            set({
                isAuthenticated: true,
                isInitialized: true,
                isLoading: false,
                error: null
            });
            
            // After successful verification, try to get the current status
            try {
                const status = await withRuntime<SlackStatus | null>(() => ObterStatusAtual(), null);
                if (status) {
                    const formattedStatus: Status = {
                        emoji: status.Emoji,
                        text: status.Mensagem
                    };
                    set({ currentStatus: formattedStatus });
                }
            } catch (statusError) {
                // Just log the error but don't fail the verification
                console.debug('Error fetching current status during verification:', statusError);
            }
        } catch (error) {
            const type = determineErrorType(error);
            const message = extractErrorMessage(error);
            
            set({
                isAuthenticated: false,
                isInitialized: true,
                isLoading: false,
                error: { type, message }
            });
            throw error;
        }
    }, SLACK_TASK_KEYS.VERIFICATION);
};

/**
 * Gets the current Slack status
 */
export const getCurrentStatus = async (
    set: (state: Partial<SlackState>) => void,
    get: () => SlackState
): Promise<Status | null> => {
    try {
        const status = await withRuntime<SlackStatus | null>(() => ObterStatusAtual(), null);
        
        if (!status) {
            set({ currentStatus: null });
            return null;
        }
        
        const formattedStatus: Status = {
            emoji: status.Emoji,
            text: status.Mensagem
        };
        
        set({ currentStatus: formattedStatus });
        return formattedStatus;
    } catch (error) {
        const type = determineErrorType(error);
        const message = extractErrorMessage(error);
        
        set({ error: { type, message } });
        throw error;
    }
};

/**
 * Sets a new Slack status
 */
export const setStatus = async (
    status: Status,
    set: (state: Partial<SlackState>) => void,
    get: () => SlackState
): Promise<void> => {
    return initializationQueue.enqueue(async () => {
        try {
            set({ isLoading: true, error: null });
            
            await withRuntime(() => DefinirStatus({
                Emoji: status.emoji,
                Mensagem: status.text
            }));
            
            set({ 
                currentStatus: status,
                isLoading: false,
                error: null
            });
        } catch (error) {
            const type = determineErrorType(error);
            const message = extractErrorMessage(error);
            
            set({ 
                isLoading: false,
                error: { type, message }
            });
            throw error;
        }
    }, SLACK_TASK_KEYS.STATUS);
};

/**
 * Clears the current Slack status
 */
export const clearStatus = async (
    set: (state: Partial<SlackState>) => void,
    get: () => SlackState
): Promise<void> => {
    return initializationQueue.enqueue(async () => {
        try {
            set({ isLoading: true, error: null });
            
            await withRuntime(() => LimparStatus());
            
            set({ 
                currentStatus: null,
                isLoading: false,
                error: null
            });
        } catch (error) {
            const type = determineErrorType(error);
            const message = extractErrorMessage(error);
            
            set({ 
                isLoading: false,
                error: { type, message }
            });
            throw error;
        }
    }, SLACK_TASK_KEYS.STATUS);
};

/**
 * Sends a message to Slack
 */
export const sendMessage = async (
    message: string,
    set: (state: Partial<SlackState>) => void,
    get: () => SlackState
): Promise<void> => {
    return initializationQueue.enqueue(async () => {
        try {
            set({ isLoading: true, error: null });
            
            await withRuntime(() => EnviarMensagem(message));
            
            set({ 
                isLoading: false,
                error: null
            });
        } catch (error) {
            const type = determineErrorType(error);
            const message = extractErrorMessage(error);
            
            set({ 
                isLoading: false,
                error: { type, message }
            });
            throw error;
        }
    }, SLACK_TASK_KEYS.MESSAGE);
};

/**
 * Gets predefined status options
 */
export const getStatusPresets = (): Status[] => {
    return [
        StatusHomeOffice,
        StatusTrabalhoPresencial,
        StatusAlmoco,
        StatusFimExpediente
    ];
};

/**
 * Gets the default status based on operation and location
 */
export const getDefaultStatus = (operation: TipoOperacao, location: string): Status => {
    const normalizedLocation = normalizeLocation(location);
    
    switch (operation) {
        case 'entrada':
            return normalizedLocation === 'HOME OFFICE' ? StatusHomeOffice : StatusTrabalhoPresencial;
        case 'almoco':
            return StatusAlmoco;
        case 'saida':
            return StatusFimExpediente;
        default:
            throw new Error(`Invalid operation: ${operation}`);
    }
};

/**
 * Gets default messages based on operation type
 */
export const getDefaultMessages = (operation: TipoOperacao): string[] => {
    switch (operation) {
        case 'entrada':
            return ['bom dia', 'voltei'];
        case 'almoco':
            return ['almoço'];
        case 'saida':
            return ['saindo', 'já volto'];
        default:
            throw new Error(`Invalid operation: ${operation}`);
    }
};

/**
 * Gets preset messages by type
 */
export const getPresetMessages = (type: TipoMensagem): string[] => {
    switch (type) {
        case 'entrada':
            return ['bom dia', 'voltei'];
        case 'refeicao':
            return ['almoço'];
        case 'saida':
            return ['saindo', 'já volto'];
        default:
            return [];
    }
}; 