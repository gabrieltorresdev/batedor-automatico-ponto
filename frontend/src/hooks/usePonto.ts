import { useState } from 'react';
import { pontoService, Localizacao, TipoOperacao } from '@/services/PontoService';
import { useNotifyStore } from '@/store/notifyStore';

export const usePonto = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [localizacaoAtual, setLocalizacaoAtual] = useState<string>('');
    const [localizacoesDisponiveis, setLocalizacoesDisponiveis] = useState<Localizacao[]>([]);
    const [operacoesDisponiveis, setOperacoesDisponiveis] = useState<TipoOperacao[]>([]);
    const addNotification = useNotifyStore((state) => state.addNotification);

    const carregarLocalizacaoAtual = async () => {
        try {
            setIsLoading(true);
            const localizacao = await pontoService.obterLocalizacaoAtual();
            setLocalizacaoAtual(localizacao);
            return localizacao;
        } catch (error) {
            addNotification((error as Error).message || 'Erro ao carregar localização atual', 'error');
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const carregarLocalizacoesDisponiveis = async () => {
        try {
            setIsLoading(true);
            const localizacoes = await pontoService.obterLocalizacoesDisponiveis();
            setLocalizacoesDisponiveis(localizacoes);
            return localizacoes;
        } catch (error) {
            addNotification((error as Error).message || 'Erro ao carregar localizações disponíveis', 'error');
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const selecionarLocalizacao = async (localizacao: Localizacao) => {
        try {
            setIsLoading(true);
            await pontoService.selecionarLocalizacao(localizacao);
            setLocalizacaoAtual(localizacao.Nome);
            // Após selecionar localização, atualiza operações disponíveis
            await carregarOperacoesDisponiveis();
        } catch (error) {
            addNotification((error as Error).message || 'Erro ao selecionar localização', 'error');
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const carregarOperacoesDisponiveis = async () => {
        try {
            setIsLoading(true);
            const operacoes = await pontoService.obterOperacoesDisponiveis();
            setOperacoesDisponiveis(operacoes);
            return operacoes;
        } catch (error) {
            addNotification((error as Error).message || 'Erro ao carregar operações disponíveis', 'error');
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const executarOperacao = async (operacao: TipoOperacao) => {
        try {
            setIsLoading(true);
            await pontoService.executarOperacao(operacao);
            addNotification('Operação realizada com sucesso!', 'success');
        } catch (error) {
            addNotification((error as Error).message || 'Erro ao executar operação', 'error');
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        isLoading,
        localizacaoAtual,
        localizacoesDisponiveis,
        operacoesDisponiveis,
        carregarLocalizacaoAtual,
        carregarLocalizacoesDisponiveis,
        selecionarLocalizacao,
        carregarOperacoesDisponiveis,
        executarOperacao
    };
}; 