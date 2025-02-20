import { ObterLocalizacaoAtual, ObterLocalizacoesDisponiveis, SelecionarLocalizacao, ObterOperacoesDisponiveis, ExecutarOperacao } from '../../wailsjs/go/main/App';

export interface Localizacao {
    Nome: string;
    Valor: string;
}

export type TipoOperacao = 'entrada' | 'almoco' | 'saida';

// Mapeamento dos valores para exibição
const operacaoDisplayMap: Record<TipoOperacao, string> = {
    'entrada': 'Entrada',
    'almoco': 'Saída refeição/descanso',
    'saida': 'Saída'
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
        return operacoes.map(op => {
            const operacao = op as TipoOperacao;
            if (!operacaoDisplayMap[operacao]) {
                console.warn('Operação desconhecida:', op);
                return 'entrada'; // fallback seguro
            }
            return operacao;
        });
    }

    getOperacaoDisplay(operacao: TipoOperacao): string {
        return operacaoDisplayMap[operacao] || operacaoDisplayMap.entrada;
    }

    async executarOperacao(operacao: TipoOperacao): Promise<void> {
        // Converte para o índice numérico baseado na ordem do enum no backend
        const operacaoIndice = {
            'entrada': 0,
            'almoco': 1,
            'saida': 2
        }[operacao] || 0;
        
        await ExecutarOperacao(operacaoIndice);
    }
}

export const pontoService = new PontoService(); 