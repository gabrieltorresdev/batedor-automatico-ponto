import { ObterStatusAtual, DefinirStatus, LimparStatus, EnviarMensagem, VerificarSessaoSlack } from '../../../wailsjs/go/main/App';
import { withRuntime } from '@/lib/wailsRuntime';
import { slackQueue } from '@/lib/initializationQueue';
import { SlackState, Status, TipoMensagem, TipoOperacao, SLACK_TASK_KEYS, SlackStatus } from './types';
import { determineErrorType, extractErrorMessage } from './utils';
import otLogo from '@/assets/images/ot.png';

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

export const normalizeLocation = (location: string): string => {
    const loc = location.toUpperCase().trim();
    if (loc === 'HOME OFFICE' || loc.includes('HOME')) return 'HOME OFFICE';
    if (loc === 'ESCRITÓRIO' || loc.includes('ESCRIT')) return 'ESCRITÓRIO';
    return loc;
};

export const initialize = async (
    set: (state: Partial<SlackState>) => void,
    get: () => SlackState
): Promise<void> => {
    const state = get();
    if (state.isInitialized || state.isLoading) return;

    try {
        await verifySlackSession(set, get);
        
        if (get().isAuthenticated) {
            await getCurrentStatus(set, get);
        }
    } catch (error) {
        console.debug('Error during Slack initialization:', error);
    }
};

export const verifySlackSession = async (
    set: (state: Partial<SlackState>) => void,
    get: () => SlackState
): Promise<void> => {
    const state = get();
    if (state.isLoading) return;

    return slackQueue.enqueue(async () => {
        try {
            set({ isLoading: true, error: null });
            await withRuntime(() => VerificarSessaoSlack());
            
            set({
                isAuthenticated: true,
                isInitialized: true,
                isLoading: false,
                error: null
            });
            
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

export const getCurrentStatus = async (
    set: (state: Partial<SlackState>) => void,
    get: () => SlackState
): Promise<Status | null> => {
    let resultStatus: Status | null = null;
    
    await slackQueue.enqueue(async () => {
        try {
            set({ isLoading: true, error: null });
            
            const status = await withRuntime<SlackStatus | null>(() => ObterStatusAtual(), null);
            
            if (!status) {
                set({ 
                    currentStatus: null,
                    isLoading: false,
                    error: null
                });
                resultStatus = null;
                return;
            }
            
            const formattedStatus: Status = {
                emoji: status.Emoji,
                text: status.Mensagem
            };
            
            set({ 
                currentStatus: formattedStatus,
                isLoading: false,
                error: null
            });
            
            resultStatus = formattedStatus;
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
    
    return resultStatus;
};

export const setStatus = async (
    status: Status,
    set: (state: Partial<SlackState>) => void,
    get: () => SlackState
): Promise<void> => {
    return slackQueue.enqueue(async () => {
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

export const clearStatus = async (
    set: (state: Partial<SlackState>) => void,
    get: () => SlackState
): Promise<void> => {
    return slackQueue.enqueue(async () => {
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

export const sendMessage = async (
    message: string,
    set: (state: Partial<SlackState>) => void,
    get: () => SlackState
): Promise<void> => {
    return slackQueue.enqueue(async () => {
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

export const getStatusPresets = (): Status[] => {
    return [
        StatusHomeOffice,
        StatusTrabalhoPresencial,
        StatusAlmoco,
        StatusFimExpediente
    ];
};

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