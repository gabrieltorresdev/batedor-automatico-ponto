import { create } from 'zustand';
import { PontoState, Localizacao, TipoOperacao } from './types';
import * as actions from './actions';

export const usePontoStore = create<PontoState>((set, get) => ({
  isLoading: false,
  isInitialized: false,
  error: null,
  localizacaoAtual: '',
  localizacoesDisponiveis: [],
  operacoesDisponiveis: [],
  initialize: async () => actions.initialize(set, get),
  obterLocalizacaoAtual: async () => actions.obterLocalizacaoAtual(set, get),
  obterLocalizacoesDisponiveis: async () => actions.obterLocalizacoesDisponiveis(set, get),
  selecionarLocalizacao: async (localizacao: Localizacao) => 
    actions.selecionarLocalizacao(localizacao, set, get),
  obterOperacoesDisponiveis: async () => actions.obterOperacoesDisponiveis(set, get),
  executarOperacao: async (operacao: TipoOperacao | string | number) => 
    actions.executarOperacao(operacao, set, get),
  setLoading: (loading: boolean) => {
    set(state => ({
      ...state,
      isLoading: loading,
      error: loading ? null : state.error
    }));
  },
  clearError: () => {
    set(state => ({ ...state, error: null }));
  },
  setError: (error) => {
    set(state => ({ ...state, error }));
  }
}));
