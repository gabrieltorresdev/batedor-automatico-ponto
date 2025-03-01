import { ObterLocalizacaoAtual, ObterLocalizacoesDisponiveis, SelecionarLocalizacao, ObterOperacoesDisponiveis, ExecutarOperacao } from '../../../wailsjs/go/main/App';
import { withRuntime } from '@/lib/wailsRuntime';
import { initializationQueue } from '@/lib/initializationQueue';
import { PontoState, PontoError, Localizacao, TipoOperacao, PONTO_TASK_KEYS } from './types';
import { determineErrorType, extractErrorMessage } from './utils';

// Mapping for operation types to indices
const operacaoIndiceMap: Record<TipoOperacao, number> = {
  'entrada': 0,
  'almoco': 1,
  'saida': 2
};

// Mapping for display names
const operacaoDisplayMap: Record<TipoOperacao, string> = {
  'entrada': 'Entrada',
  'almoco': 'Saída Refeição/Descanso',
  'saida': 'Saída'
};

// Normalize operation to standard type
export const normalizarOperacao = (operacao: string | number): TipoOperacao => {
  if (typeof operacao === 'number') {
    switch (operacao) {
      case 0: return 'entrada';
      case 1: return 'almoco';
      case 2: return 'saida';
      default: throw new Error(`Operação inválida: ${operacao}`);
    }
  }

  const operacaoLower = operacao.toString().toLowerCase().trim();
  
  // Map common variations to standard types
  if (operacaoLower === 'entrada' || operacaoLower === '0') return 'entrada';
  if (operacaoLower === 'almoco' || operacaoLower === 'saída refeição/descanso' || 
      operacaoLower === 'saida refeicao/descanso' || operacaoLower === '1') return 'almoco';
  if (operacaoLower === 'saida' || operacaoLower === 'saída' || operacaoLower === '2') return 'saida';
  
  throw new Error(`Operação inválida: ${operacao}`);
};

// Get display name for operation
export const getOperacaoDisplay = (operacao: TipoOperacao | string | number): string => {
  const normalizedOp = typeof operacao === 'string' && 
    (operacao === 'entrada' || operacao === 'almoco' || operacao === 'saida') 
    ? operacao as TipoOperacao 
    : normalizarOperacao(operacao);
  
  return operacaoDisplayMap[normalizedOp];
};

/**
 * Initialize the ponto module
 */
export const initialize = async (
  set: (state: Partial<PontoState>) => void,
  get: () => PontoState
): Promise<void> => {
  const state = get();
  if (state.isInitialized || state.isLoading) return;

  return initializationQueue.enqueue(async () => {
    try {
      set({ isLoading: true, error: null });
      
      // Load current location
      const localizacaoAtual = await withRuntime<string>(
        () => ObterLocalizacaoAtual(),
        ''
      );
      
      // Load available locations
      const localizacoesDisponiveis = await withRuntime<Localizacao[]>(
        () => ObterLocalizacoesDisponiveis(),
        []
      );
      
      // Load available operations
      const operacoesRaw = await withRuntime<Array<string | number>>(
        () => ObterOperacoesDisponiveis(),
        []
      );
      
      // Normalize operations
      const operacoesDisponiveis = [...new Set(operacoesRaw)]
        .map(op => {
          try {
            return normalizarOperacao(op);
          } catch (error) {
            console.warn('Operação inválida ignorada:', op);
            return null;
          }
        })
        .filter((op): op is TipoOperacao => op !== null);
      
      set({
        isInitialized: true,
        isLoading: false,
        localizacaoAtual,
        localizacoesDisponiveis,
        operacoesDisponiveis,
        error: null
      });
    } catch (error) {
      const type = determineErrorType(error);
      const message = extractErrorMessage(error);
      
      set({
        isInitialized: true,
        isLoading: false,
        error: { type, message }
      });
      throw error;
    }
  }, PONTO_TASK_KEYS.INITIALIZATION);
};

/**
 * Get current location
 */
export const obterLocalizacaoAtual = async (
  set: (state: Partial<PontoState>) => void,
  get: () => PontoState
): Promise<string> => {
  const state = get();
  if (state.isLoading) return state.localizacaoAtual;

  let result = '';
  await initializationQueue.enqueue(async () => {
    try {
      set({ isLoading: true, error: null });
      const localizacao = await withRuntime<string>(
        () => ObterLocalizacaoAtual(),
        ''
      );
      
      set({ 
        localizacaoAtual: localizacao,
        isLoading: false
      });
      
      result = localizacao;
    } catch (error) {
      const type = determineErrorType(error);
      const message = extractErrorMessage(error);
      
      set({
        isLoading: false,
        error: { type, message }
      });
      throw error;
    }
  }, PONTO_TASK_KEYS.LOCALIZACAO);
  
  return result;
};

/**
 * Get available locations
 */
export const obterLocalizacoesDisponiveis = async (
  set: (state: Partial<PontoState>) => void,
  get: () => PontoState
): Promise<Localizacao[]> => {
  const state = get();
  if (state.isLoading) return state.localizacoesDisponiveis;
  
  let result: Localizacao[] = [];
  await initializationQueue.enqueue(async () => {
    try {
      set({ isLoading: true, error: null });
      const localizacoes = await withRuntime<Localizacao[]>(
        () => ObterLocalizacoesDisponiveis(),
        []
      );
      
      set({ 
        localizacoesDisponiveis: localizacoes,
        isLoading: false
      });
      
      result = localizacoes;
    } catch (error) {
      const type = determineErrorType(error);
      const message = extractErrorMessage(error);
      
      set({
        isLoading: false,
        error: { type, message }
      });
      throw error;
    }
  }, PONTO_TASK_KEYS.LOCALIZACAO);
  
  return result;
};

/**
 * Select a location
 */
export const selecionarLocalizacao = async (
  localizacao: Localizacao,
  set: (state: Partial<PontoState>) => void,
  get: () => PontoState
): Promise<void> => {
  return initializationQueue.enqueue(async () => {
    try {
      set({ isLoading: true, error: null });
      
      // Select location
      await withRuntime(
        () => SelecionarLocalizacao(localizacao)
      );
      
      // Update current location
      const novaLocalizacao = await withRuntime<string>(
        () => ObterLocalizacaoAtual(),
        ''
      );
      
      // Update available operations
      const operacoesRaw = await withRuntime<Array<string | number>>(
        () => ObterOperacoesDisponiveis(),
        []
      );
      
      // Normalize operations
      const operacoesDisponiveis = [...new Set(operacoesRaw)]
        .map(op => {
          try {
            return normalizarOperacao(op);
          } catch (error) {
            console.warn('Operação inválida ignorada:', op);
            return null;
          }
        })
        .filter((op): op is TipoOperacao => op !== null);
      
      set({
        localizacaoAtual: novaLocalizacao,
        operacoesDisponiveis,
        isLoading: false
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
  }, PONTO_TASK_KEYS.LOCALIZACAO);
};

/**
 * Get available operations
 */
export const obterOperacoesDisponiveis = async (
  set: (state: Partial<PontoState>) => void,
  get: () => PontoState
): Promise<TipoOperacao[]> => {
  const state = get();
  if (state.isLoading) return state.operacoesDisponiveis;
  
  let result: TipoOperacao[] = [];
  await initializationQueue.enqueue(async () => {
    try {
      set({ isLoading: true, error: null });
      const operacoes = await withRuntime<TipoOperacao[]>(
        () => ObterOperacoesDisponiveis(),
        []
      );
      
      set({ 
        operacoesDisponiveis: operacoes,
        isLoading: false
      });
      
      result = operacoes;
    } catch (error) {
      const type = determineErrorType(error);
      const message = extractErrorMessage(error);
      
      set({
        isLoading: false,
        error: { type, message }
      });
      throw error;
    }
  }, PONTO_TASK_KEYS.OPERACOES);
  
  return result;
};

/**
 * Execute an operation
 */
export const executarOperacao = async (
  operacao: TipoOperacao | string | number,
  set: (state: Partial<PontoState>) => void,
  get: () => PontoState
): Promise<void> => {
  return initializationQueue.enqueue(async () => {
    try {
      set({ isLoading: true, error: null });
      
      // Normalize operation
      const operacaoNormalizada = typeof operacao === 'string' && 
        (operacao === 'entrada' || operacao === 'almoco' || operacao === 'saida') 
        ? operacao as TipoOperacao 
        : normalizarOperacao(operacao);
      
      // Get operation index
      const operacaoIndice = operacaoIndiceMap[operacaoNormalizada];
      
      // Execute operation
      await withRuntime(
        () => ExecutarOperacao(operacaoIndice)
      );
      
      set({ isLoading: false });
    } catch (error) {
      const type = determineErrorType(error);
      const message = extractErrorMessage(error);
      
      set({
        isLoading: false,
        error: { type, message }
      });
      throw error;
    }
  }, PONTO_TASK_KEYS.EXECUCAO);
};