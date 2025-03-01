import { ObterStatusAtual, DefinirStatus, LimparStatus, EnviarMensagem } from '../../wailsjs/go/main/App';
import { Status, TipoMensagem, TipoOperacao } from '@/store/slack/types';
import otLogo from '@/assets/images/ot.png';

// Status predefinidos
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

/**
 * Service responsible for managing Slack status and messages
 */
class SlackService {
    /**
     * Normalizes location string to standard format
     */
    private normalizeLocation(location: string): string {
        const loc = location.toUpperCase().trim();
        if (loc === 'HOME OFFICE' || loc.includes('HOME')) return 'HOME OFFICE';
        if (loc === 'ESCRITÓRIO' || loc.includes('ESCRIT')) return 'ESCRITÓRIO';
        return loc;
    }

    /**
     * Gets the current Slack status
     */
    async getCurrentStatus(): Promise<Status | null> {
        const status = await ObterStatusAtual();
        if (!status) return null;
        
        return {
            emoji: status.Emoji,
            text: status.Mensagem
        };
    }

    /**
     * Sets a new Slack status
     */
    async setStatus(status: Status): Promise<void> {
        await DefinirStatus({
            Emoji: status.emoji,
            Mensagem: status.text
        });
    }

    /**
     * Alias for setStatus to maintain compatibility
     * @deprecated Use setStatus instead
     */
    async atualizarStatus(status: Status): Promise<void> {
        return this.setStatus(status);
    }

    /**
     * Alias for getCurrentStatus to maintain compatibility
     * @deprecated Use getCurrentStatus instead
     */
    async obterStatusAtual(): Promise<Status | null> {
        return this.getCurrentStatus();
    }

    /**
     * Alias for setStatus to maintain compatibility
     * @deprecated Use setStatus instead
     */
    async definirStatus(status: Status): Promise<void> {
        return this.setStatus(status);
    }

    /**
     * Clears the current Slack status
     */
    async clearStatus(): Promise<void> {
        await LimparStatus();
    }

    /**
     * Alias for clearStatus to maintain compatibility
     * @deprecated Use clearStatus instead
     */
    async limparStatus(): Promise<void> {
        return this.clearStatus();
    }

    /**
     * Gets predefined status options
     */
    getStatusPresets(): Status[] {
        return [
            StatusHomeOffice,
            StatusTrabalhoPresencial,
            StatusAlmoco,
            StatusFimExpediente
        ];
    }

    /**
     * Alias for getStatusPresets to maintain compatibility
     * @deprecated Use getStatusPresets instead
     */
    getAvailableStatuses(): Status[] {
        return this.getStatusPresets();
    }

    /**
     * Gets the default status based on operation and location
     */
    getDefaultStatus(operation: TipoOperacao, location: string): Status {
        const normalizedLocation = this.normalizeLocation(location);
        
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
    }

    /**
     * Gets default messages based on operation type
     */
    getDefaultMessages(operation: TipoOperacao): string[] {
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
    }

    /**
     * Alias for getDefaultMessages to maintain compatibility
     * @deprecated Use getDefaultMessages instead
     */
    getDefaultMensagens(operation: TipoOperacao): string[] {
        return this.getDefaultMessages(operation);
    }

    /**
     * Sends a message to Slack
     */
    async sendMessage(message: string): Promise<void> {
        await EnviarMensagem(message);
    }

    /**
     * Alias for sendMessage to maintain compatibility
     * @deprecated Use sendMessage instead
     */
    async enviarMensagem(message: string): Promise<void> {
        return this.sendMessage(message);
    }

    /**
     * Prepares a message based on message type
     */
    async prepareMessage(type: TipoMensagem): Promise<{ confirmed: boolean; message: string }> {
        const messages = this.getPresetMessages(type);
        if (messages.length === 0) {
            return { confirmed: false, message: '' };
        }
        return { confirmed: true, message: messages[0] };
    }

    /**
     * Alias for prepareMessage to maintain compatibility
     * @deprecated Use prepareMessage instead
     */
    async prepararMensagem(type: TipoMensagem): Promise<{ confirmado: boolean; mensagem: string }> {
        const result = await this.prepareMessage(type);
        return { 
            confirmado: result.confirmed, 
            mensagem: result.message 
        };
    }

    /**
     * Gets preset messages by type
     */
    getPresetMessages(type: TipoMensagem): string[] {
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
    }

    /**
     * Alias for getPresetMessages to maintain compatibility
     * @deprecated Use getPresetMessages instead
     */
    getMensagensPreset(type: TipoMensagem): string[] {
        return this.getPresetMessages(type);
    }
}

export const slackService = new SlackService();