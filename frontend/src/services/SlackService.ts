import { ObterStatusAtual, DefinirStatus, LimparStatus, EnviarMensagem, PrepararMensagem } from '../../wailsjs/go/main/App';
import { Status } from '@/types/slack';
import otLogo from '@/assets/images/ot.png';

// Status predefinidos
export const StatusTrabalhoPresencial: Status = {
    emoji: otLogo,
    mensagem: 'Trabalhando Presencialmente'
};

export const StatusHomeOffice: Status = {
    emoji: '🏡',
    mensagem: 'Trabalhando remotamente'
};

export const StatusAlmoco: Status = {
    emoji: '🍽️',
    mensagem: 'Almoço'
};

export const StatusFimExpediente: Status = {
    emoji: '🛏️',
    mensagem: 'Fora do Expediente'
};

// Tipos de mensagem
export type TipoMensagem = 'entrada' | 'refeicao' | 'saida';
export type TipoOperacao = 'entrada' | 'almoco' | 'saida';

class SlackService {
    // Função auxiliar para normalizar a localização
    private normalizarLocalizacao(localizacao: string): string {
        const loc = localizacao.toUpperCase().trim();
        if (loc === 'HOME OFFICE' || loc.includes('HOME')) return 'HOME OFFICE';
        if (loc === 'ESCRITÓRIO' || loc.includes('ESCRIT')) return 'ESCRITÓRIO';
        return loc;
    }

    async obterStatusAtual(): Promise<Status | null> {
        const status = await ObterStatusAtual();
        if (!status) return null;
        
        return {
            emoji: status.Emoji,
            mensagem: status.Mensagem
        };
    }

    async definirStatus(status: Status): Promise<void> {
        await DefinirStatus({
            Emoji: status.emoji,
            Mensagem: status.mensagem
        });
    }

    async limparStatus(): Promise<void> {
        await LimparStatus();
    }

    // Status pré-definidos comuns
    getStatusPresets(): Status[] {
        return [
            StatusHomeOffice,
            StatusTrabalhoPresencial,
            StatusAlmoco,
            StatusFimExpediente
        ];
    }

    // Obtém o status padrão baseado na operação e localização
    getDefaultStatus(operacao: TipoOperacao, localizacao: string): Status {
        const locNormalizada = this.normalizarLocalizacao(localizacao);
        
        switch (operacao) {
            case 'entrada':
                return locNormalizada === 'HOME OFFICE' ? StatusHomeOffice : StatusTrabalhoPresencial;
            case 'almoco':
                return StatusAlmoco;
            case 'saida':
                return StatusFimExpediente;
            default:
                return StatusTrabalhoPresencial;
        }
    }

    // Obtém as mensagens padrão baseadas na operação
    getDefaultMensagens(operacao: TipoOperacao): string[] {
        switch (operacao) {
            case 'entrada':
                return ['bom dia', 'voltei'];
            case 'almoco':
                return ['almoço'];
            case 'saida':
                return ['saindo', 'já volto'];
            default:
                return [];
        }
    }

    async enviarMensagem(mensagem: string): Promise<void> {
        await EnviarMensagem(mensagem);
    }

    async prepararMensagem(tipo: TipoMensagem): Promise<{ confirmado: boolean; mensagem: string }> {
        const mensagens = this.getMensagensPreset(tipo);
        if (mensagens.length === 0) {
            return { confirmado: false, mensagem: '' };
        }

        const confirmado = await PrepararMensagem(tipo);
        return { confirmado, mensagem: mensagens[0] };
    }

    // Mensagens pré-definidas por tipo
    getMensagensPreset(tipo: TipoMensagem): string[] {
        switch (tipo) {
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
}

export const slackService = new SlackService();