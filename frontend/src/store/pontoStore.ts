import { create } from 'zustand';
import { ObterLocalizacaoAtual, ObterOperacoesDisponiveis, ExecutarOperacao, ObterLocalizacoesDisponiveis, SelecionarLocalizacao } from '../../wailsjs/go/main/App';
import { Localizacao } from '@/services/PontoService';

interface PontoStore {
    isLoading: boolean;
    obterLocalizacaoAtual: () => Promise<string>;
    obterLocalizacoesDisponiveis: () => Promise<Localizacao[]>;
    selecionarLocalizacao: (localizacao: Localizacao) => Promise<void>;
    obterOperacoesDisponiveis: () => Promise<Array<string | number>>;
    executarOperacao: (operacao: string | number) => Promise<void>;
}

export const usePontoStore = create<PontoStore>((set) => ({
    isLoading: false,
    obterLocalizacaoAtual: async () => {
        set({ isLoading: true });
        try {
            return await ObterLocalizacaoAtual();
        } finally {
            set({ isLoading: false });
        }
    },
    obterLocalizacoesDisponiveis: async () => {
        set({ isLoading: true });
        try {
            return await ObterLocalizacoesDisponiveis();
        } finally {
            set({ isLoading: false });
        }
    },
    selecionarLocalizacao: async (localizacao: Localizacao) => {
        set({ isLoading: true });
        try {
            await SelecionarLocalizacao(localizacao);
        } finally {
            set({ isLoading: false });
        }
    },
    obterOperacoesDisponiveis: async () => {
        set({ isLoading: true });
        try {
            return await ObterOperacoesDisponiveis();
        } finally {
            set({ isLoading: false });
        }
    },
    executarOperacao: async (operacao: string | number) => {
        set({ isLoading: true });
        try {
            await ExecutarOperacao(operacao);
        } finally {
            set({ isLoading: false });
        }
    }
})); 