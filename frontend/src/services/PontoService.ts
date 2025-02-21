import { ObterLocalizacaoAtual, ObterLocalizacoesDisponiveis, SelecionarLocalizacao, ObterOperacoesDisponiveis, ExecutarOperacao } from '../../wailsjs/go/main/App';

export interface Localizacao {
    Nome: string;
    Valor: string;
}

export type TipoOperacao = 'entrada' | 'almoco' | 'saida';

// Mapeamento dos valores para exibição
const operacaoDisplayMap: Record<TipoOperacao, string> = {
    'entrada': 'Entrada',
    'almoco': 'Saída Refeição/Descanso',
    'saida': 'Saída'
};

// Mapeamento reverso para normalização
const operacaoNormalizeMap: Record<string, TipoOperacao> = {
    'entrada': 'entrada',
    'saída refeição/descanso': 'almoco',
    'saida refeicao/descanso': 'almoco',
    'almoco': 'almoco',
    'saída': 'saida',
    'saida': 'saida',
    '0': 'entrada',
    '1': 'almoco',
    '2': 'saida'
};

class PontoService {
    async obterLocalizacaoAtual(): Promise<string> {
        return ObterLocalizacaoAtual();
    }

    async obterLocalizacoesDisponiveis(): Promise<Localizacao[]> {
        return ObterLocalizacoesDisponiveis();
    }

    async selecionarLocalizacao(localizacao: Localizacao): Promise<void> {
        await SelecionarLocalizacao(localizacao);
    }

    async obterOperacoesDisponiveis(): Promise<TipoOperacao[]> {
        const operacoes = await ObterOperacoesDisponiveis();
        // Remove duplicatas e mapeia os valores
        return [...new Set(operacoes)].map(op => this.normalizarOperacao(op));
    }

    getOperacaoDisplay(operacao: TipoOperacao | string | number): string {
        const normalizedOp = this.normalizarOperacao(operacao);
        return operacaoDisplayMap[normalizedOp];
    }

    normalizarOperacao(operacao: string | number): TipoOperacao {
        if (typeof operacao === 'number') {
            const opStr = operacao.toString();
            if (operacaoNormalizeMap[opStr]) {
                return operacaoNormalizeMap[opStr];
            }
            // Se não encontrar no mapa, usa a lógica antiga
            switch (operacao) {
                case 0: return 'entrada';
                case 1: return 'almoco';
                case 2: return 'saida';
                default: throw new Error(`Operação inválida: ${operacao}`);
            }
        }

        const operacaoLower = operacao.toString().toLowerCase().trim();
        const normalizedOp = operacaoNormalizeMap[operacaoLower];
        if (!normalizedOp) {
            throw new Error(`Operação inválida: ${operacao}`);
        }
        return normalizedOp;
    }

    // Função auxiliar para normalizar localização
    normalizarLocalizacao(localizacao: string): string {
        const loc = localizacao.toUpperCase().trim();
        if (loc === 'HOME OFFICE' || loc.includes('HOME')) return 'HOME OFFICE';
        if (loc === 'ESCRITÓRIO' || loc.includes('ESCRIT')) return 'ESCRITÓRIO';
        return loc;
    }

    async executarOperacao(operacao: TipoOperacao | string | number): Promise<void> {
        const operacaoNormalizada = this.normalizarOperacao(operacao);
        const mapeamentoIndices: Record<TipoOperacao, number> = {
            'entrada': 0,
            'almoco': 1,
            'saida': 2
        };
        
        const operacaoIndice = mapeamentoIndices[operacaoNormalizada];
        if (operacaoIndice === undefined) {
            throw new Error(`Operação inválida: ${operacao}`);
        }
        
        await ExecutarOperacao(operacaoIndice);
    }
}

export const pontoService = new PontoService(); 