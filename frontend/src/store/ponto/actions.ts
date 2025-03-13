import { ObterLocalizacaoAtual, ObterLocalizacoesDisponiveis, SelecionarLocalizacao, ObterOperacoesDisponiveis, ExecutarOperacao } from '../../../wailsjs/go/main/App';
import { withRuntime } from '@/lib/wailsRuntime';
import { pontoQueue } from '@/lib/initializationQueue';
import { PontoState, PontoError, Localizacao, TipoOperacao, PONTO_TASK_KEYS } from './types';
import { determineErrorType, extractErrorMessage } from './utils';

const operacaoIndiceMap: Record<TipoOperacao, number> = {
  'entrada': 0,
  'almoco': 1,
  'saida': 2
};

const operacaoDisplayMap: Record<TipoOperacao, string> = {
  'entrada': 'Entrada',
  'almoco': 'Saída Refeição/Descanso',
  'saida': 'Saída'
};

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
  
  if (operacaoLower === 'entrada' || operacaoLower === '0') return 'entrada';
  if (operacaoLower === 'almoco' || operacaoLower === 'saída refeição/descanso' || 
      operacaoLower === 'saida refeicao/descanso' || operacaoLower === '1') return 'almoco';
  if (operacaoLower === 'saida' || operacaoLower === 'saída' || operacaoLower === '2') return 'saida';
  
  throw new Error(`Operação inválida: ${operacao}`);
};

export const getOperacaoDisplay = (operacao: TipoOperacao | string | number): string => {
  const normalizedOp = typeof operacao === 'string' && 
    (operacao === 'entrada' || operacao === 'almoco' || operacao === 'saida') 
    ? operacao as TipoOperacao 
    : normalizarOperacao(operacao);
  
  return operacaoDisplayMap[normalizedOp];
};

export const initialize = async (
  set: (state: Partial<PontoState>) => void,
  get: () => PontoState
): Promise<void> => {
  const state = get();
  if (state.isInitialized || state.isLoading) return;

  return pontoQueue.enqueue(async () => {
    try {
      set({ isLoading: true, error: null });
      
      const localizacaoAtual = await withRuntime<string>(
        () => ObterLocalizacaoAtual(),
        ''
      );
      
      const localizacoesDisponiveis = await withRuntime<Localizacao[]>(
        () => ObterLocalizacoesDisponiveis(),
        []
      );
      
      const operacoesRaw = await withRuntime<Array<string | number>>(
        () => ObterOperacoesDisponiveis(),
        []
      );
      
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

export const obterLocalizacaoAtual = async (
  set: (state: Partial<PontoState>) => void,
  get: () => PontoState
): Promise<string> => {
  const state = get();
  if (state.isLoading) return state.localizacaoAtual || '';
  
  let result = '';
  await pontoQueue.enqueue(async () => {
    try {
      set({ isLoading: true, error: null });
      
      const localizacao = await withRuntime<string>(
        () => ObterLocalizacaoAtual(),
        ''
      );
      
      set({ 
        localizacaoAtual: localizacao,
        isLoading: false,
        error: null
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

export const obterLocalizacoesDisponiveis = async (
  set: (state: Partial<PontoState>) => void,
  get: () => PontoState
): Promise<Localizacao[]> => {
  const state = get();
  if (state.isLoading) {
    console.log("Ponto: Já existe uma requisição em andamento para localizações, retornando dados em cache:", 
                state.localizacoesDisponiveis?.length || 0);
    return state.localizacoesDisponiveis;
  }
  
  if (state.localizacoesDisponiveis && state.localizacoesDisponiveis.length > 0) {
    console.log("Ponto: Já temos localizações em cache, retornando:", state.localizacoesDisponiveis.length);
    return state.localizacoesDisponiveis;
  }

  let result: Localizacao[] = [];
  await pontoQueue.enqueue(async () => {
    try {
      console.log("Ponto: Buscando localizações disponíveis do backend");
      set({ isLoading: true, error: null });
      
      const localizacoes = await withRuntime<Localizacao[]>(
        () => ObterLocalizacoesDisponiveis(),
        []
      );
      
      console.log("Ponto: Localizações recebidas do backend:", localizacoes);
      
      if (!localizacoes) {
        console.warn("Ponto: ObterLocalizacoesDisponiveis retornou nulo ou undefined");
        set({ 
          localizacoesDisponiveis: [],
          isLoading: false,
          error: { 
            type: 'network', 
            message: 'Nenhuma localização disponível' 
          }
        });
        result = [];
        return;
      }
      
      if (!Array.isArray(localizacoes)) {
        console.warn("Ponto: ObterLocalizacoesDisponiveis retornou um não-array:", localizacoes);
        set({ 
          localizacoesDisponiveis: [],
          isLoading: false,
          error: { 
            type: 'runtime', 
            message: 'Formato de dados inválido para localizações' 
          }
        });
        result = [];
        return;
      }
      
      const localizacoesValidas = localizacoes.filter(loc => {
        if (!loc || typeof loc !== 'object') {
          console.warn("Ponto: Localização inválida (não é objeto):", loc);
          return false;
        }
        
        if (!('Nome' in loc) || !('Valor' in loc)) {
          console.warn("Ponto: Localização sem Nome ou Valor:", loc);
          return false;
        }
        
        return true;
      });
      
      console.log("Ponto: Localizações válidas:", localizacoesValidas.length);
      
      set({ 
        localizacoesDisponiveis: localizacoesValidas,
        isLoading: false,
        error: null
      });
      
      result = localizacoesValidas;
    } catch (error) {
      const type = determineErrorType(error);
      const message = extractErrorMessage(error);
      
      console.error("Ponto: Erro ao obter localizações disponíveis:", type, message, error);
      
      set({
        isLoading: false,
        error: { type, message }
      });
      throw error;
    }
  }, PONTO_TASK_KEYS.LOCALIZACAO);
  
  return result;
};

export const selecionarLocalizacao = async (
  localizacao: Localizacao,
  set: (state: Partial<PontoState>) => void,
  get: () => PontoState
): Promise<void> => {
  return pontoQueue.enqueue(async () => {
    try {
      set({ isLoading: true, error: null });
      
      await withRuntime(
        () => SelecionarLocalizacao(localizacao)
      );
      
      const novaLocalizacao = await withRuntime<string>(
        () => ObterLocalizacaoAtual(),
        ''
      );
      
      const operacoesRaw = await withRuntime<Array<string | number>>(
        () => ObterOperacoesDisponiveis(),
        []
      );
      
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

export const obterOperacoesDisponiveis = async (
  set: (state: Partial<PontoState>) => void,
  get: () => PontoState
): Promise<TipoOperacao[]> => {
  const state = get();
  if (state.isLoading) {
    console.log("Ponto: Já existe uma requisição em andamento para operações, retornando dados em cache");
    return state.operacoesDisponiveis;
  }
  
  let result: TipoOperacao[] = [];
  await pontoQueue.enqueue(async () => {
    try {
      console.log("Ponto: Buscando operações disponíveis");
      set({ isLoading: true, error: null });
      
      const operacoesRaw = await withRuntime<Array<string | number>>(
        () => ObterOperacoesDisponiveis(),
        []
      );
      
      console.log("Ponto: Operações recebidas do backend:", operacoesRaw);
      
      if (!operacoesRaw) {
        console.warn("Ponto: ObterOperacoesDisponiveis retornou nulo ou undefined");
        set({ 
          operacoesDisponiveis: [],
          isLoading: false,
          error: { 
            type: 'runtime', 
            message: 'Nenhuma operação disponível' 
          }
        });
        result = [];
        return;
      }
      
      if (!Array.isArray(operacoesRaw)) {
        console.warn("Ponto: ObterOperacoesDisponiveis retornou um não-array:", operacoesRaw);
        set({ 
          operacoesDisponiveis: [],
          isLoading: false,
          error: { 
            type: 'runtime', 
            message: 'Formato de dados inválido para operações' 
          }
        });
        result = [];
        return;
      }
      
      const operacoes = [...new Set(operacoesRaw)]
        .map(op => {
          try {
            return normalizarOperacao(op);
          } catch (error) {
            console.warn('Ponto: Operação inválida ignorada:', op, error);
            return null;
          }
        })
        .filter((op): op is TipoOperacao => op !== null);
      
      console.log("Ponto: Operações normalizadas:", operacoes);
      
      set({ 
        operacoesDisponiveis: operacoes,
        isLoading: false,
        error: null
      });
      
      result = operacoes;
    } catch (error) {
      const type = determineErrorType(error);
      const message = extractErrorMessage(error);
      
      console.error("Ponto: Erro ao obter operações disponíveis:", type, message, error);
      
      set({
        isLoading: false,
        error: { type, message }
      });
      throw error;
    }
  }, PONTO_TASK_KEYS.OPERACOES);
  
  return result;
};

export const executarOperacao = async (
  operacao: TipoOperacao | string | number,
  set: (state: Partial<PontoState>) => void,
  get: () => PontoState
): Promise<void> => {
  return pontoQueue.enqueue(async () => {
    try {
      set({ isLoading: true, error: null });
      
      const operacaoNormalizada = typeof operacao === 'string' && 
        (operacao === 'entrada' || operacao === 'almoco' || operacao === 'saida') 
        ? operacao as TipoOperacao 
        : normalizarOperacao(operacao);
      
      const operacaoIndice = operacaoIndiceMap[operacaoNormalizada];
      
      console.log(`Ponto: Executando operação ${operacaoNormalizada} (${operacaoIndice})`);
      await withRuntime(
        () => ExecutarOperacao(operacaoIndice)
      );
      
      console.log('Ponto: Operação executada com sucesso, atualizando operações');
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      try {
        console.log('Ponto: Buscando operações atualizadas após execução');
        const novasOperacoes = await withRuntime<Array<string | number>>(
          () => ObterOperacoesDisponiveis(),
          []
        );
        
        console.log('Ponto: Operações recebidas após execução:', novasOperacoes);
        
        if (!novasOperacoes || !Array.isArray(novasOperacoes)) {
          console.warn('Ponto: Dados de operações inválidos após execução:', novasOperacoes);
          set({ isLoading: false });
          return;
        }
        
        const operacoesAtualizadas = [...new Set(novasOperacoes)]
          .map(op => {
            try {
              return normalizarOperacao(op);
            } catch (error) {
              console.warn('Ponto: Operação inválida ignorada:', op);
              return null;
            }
          })
          .filter((op): op is TipoOperacao => op !== null);
        
        console.log('Ponto: Novas operações disponíveis após execução:', operacoesAtualizadas);
        set({ 
          operacoesDisponiveis: operacoesAtualizadas,
          isLoading: false 
        });
      } catch (error) {
        console.error('Ponto: Erro ao atualizar operações após execução:', error);
        set({ isLoading: false });
      }
    } catch (error) {
      const type = determineErrorType(error);
      const message = extractErrorMessage(error);
      
      console.error(`Ponto: Erro ao executar operação ${String(operacao)}:`, message);
      set({
        isLoading: false,
        error: { type, message }
      });
      throw error;
    }
  }, PONTO_TASK_KEYS.EXECUCAO);
};