import { ObterStatusAtual, DefinirStatus, LimparStatus, EnviarMensagem } from '../../wailsjs/go/main/App';
import { Status, TipoMensagem, TipoOperacao } from '@/store/slack/types';
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

class SlackService {
    private normalizeLocation(location: string): string {
        const loc = location.toUpperCase().trim();
        if (loc === 'HOME OFFICE' || loc.includes('HOME')) return 'HOME OFFICE';
        if (loc === 'ESCRITÓRIO' || loc.includes('ESCRIT')) return 'ESCRITÓRIO';
        return loc;
    }

    async getCurrentStatus(): Promise<Status | null> {
        const status = await ObterStatusAtual();
        if (!status) return null;
        
        return {
            emoji: status.Emoji,
            text: status.Mensagem
        };
    }

    async setStatus(status: Status): Promise<void> {
        await DefinirStatus({
            Emoji: status.emoji,
            Mensagem: status.text
        });
    }

    async atualizarStatus(status: Status): Promise<void> {
        return this.setStatus(status);
    }

    async obterStatusAtual(): Promise<Status | null> {
        return this.getCurrentStatus();
    }

    async definirStatus(status: Status): Promise<void> {
        return this.setStatus(status);
    }

    async clearStatus(): Promise<void> {
        await LimparStatus();
    }

    async limparStatus(): Promise<void> {
        return this.clearStatus();
    }

    getStatusPresets(): Status[] {
        return [
            StatusHomeOffice,
            StatusTrabalhoPresencial,
            StatusAlmoco,
            StatusFimExpediente
        ];
    }

    getAvailableStatuses(): Status[] {
        return this.getStatusPresets();
    }

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

    getDefaultMensagens(operation: TipoOperacao): string[] {
        return this.getDefaultMessages(operation);
    }

    async sendMessage(message: string): Promise<void> {
        await EnviarMensagem(message);
    }

    async enviarMensagem(message: string): Promise<void> {
        return this.sendMessage(message);
    }

    async prepareMessage(type: TipoMensagem): Promise<{ confirmed: boolean; message: string }> {
        const messages = this.getPresetMessages(type);
        if (messages.length === 0) {
            return { confirmed: false, message: '' };
        }
        return { confirmed: true, message: messages[0] };
    }

    async prepararMensagem(type: TipoMensagem): Promise<{ confirmado: boolean; mensagem: string }> {
        const result = await this.prepareMessage(type);
        return { 
            confirmado: result.confirmed, 
            mensagem: result.message 
        };
    }

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

    getMensagensPreset(type: TipoMensagem): string[] {
        return this.getPresetMessages(type);
    }
}

export const slackService = new SlackService();