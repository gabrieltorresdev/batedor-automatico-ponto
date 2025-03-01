import { create } from 'zustand';
import { PontoState, Localizacao, TipoOperacao } from './types';
import * as actions from './actions';

/**
 * Ponto store that manages time clock operations
 */
export const usePontoStore = create<PontoState>((set, get) => ({
  isLoading: false,
  isInitialized: false,
  error: null,
  localizacaoAtual: '',
  localizacoesDisponiveis: [],
  operacoesDisponiveis: [],
  
  // Initialize the ponto module
  initialize: async () => actions.initialize(set, get),
  
  // Get current location
  obterLocalizacaoAtual: async () => actions.obterLocalizacaoAtual(set, get),
  
  // Get available locations
  obterLocalizacoesDisponiveis: async () => actions.obterLocalizacoesDisponiveis(set, get),
  
  // Select a location
  selecionarLocalizacao: async (localizacao: Localizacao) => 
    actions.selecionarLocalizacao(localizacao, set, get),
  
  // Get available operations
  obterOperacoesDisponiveis: async () => actions.obterOperacoesDisponiveis(set, get),
  
  // Execute an operation
  executarOperacao: async (operacao: TipoOperacao | string | number) => 
    actions.executarOperacao(operacao, set, get),
  
  // State management
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
