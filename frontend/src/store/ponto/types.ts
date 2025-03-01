import { RetryStatus } from '@/lib/initializationQueue';

// Location types
export interface Localizacao {
  Nome: string;
  Valor: string;
}

// Operation types
export type TipoOperacao = 'entrada' | 'almoco' | 'saida';

// Error types
export type PontoErrorType = 'network' | 'runtime' | 'blocked' | 'invalid_operation';

export interface PontoError {
  type: PontoErrorType;
  message: string;
}

// Retry status for ponto tasks
export interface PontoRetryStatus {
  localizacao: RetryStatus | { isRetrying: boolean; retryAttempt: number; maxRetries: number; };
  operacoes: RetryStatus | { isRetrying: boolean; retryAttempt: number; maxRetries: number; };
  execucao: RetryStatus | { isRetrying: boolean; retryAttempt: number; maxRetries: number; };
  isRetrying: boolean;
  active: RetryStatus | null;
}

// Ponto state interface
export interface PontoState {
  isLoading: boolean;
  isInitialized: boolean;
  error: PontoError | null;
  localizacaoAtual: string;
  localizacoesDisponiveis: Localizacao[];
  operacoesDisponiveis: TipoOperacao[];
  
  // Methods
  initialize: () => Promise<void>;
  obterLocalizacaoAtual: () => Promise<string>;
  obterLocalizacoesDisponiveis: () => Promise<Localizacao[]>;
  selecionarLocalizacao: (localizacao: Localizacao) => Promise<void>;
  obterOperacoesDisponiveis: () => Promise<TipoOperacao[]>;
  executarOperacao: (operacao: TipoOperacao | string | number) => Promise<void>;
  
  // State management
  setLoading: (loading: boolean) => void;
  clearError: () => void;
  setError: (error: PontoError) => void;
}

// Constants for task keys
export const PONTO_TASK_KEYS = {
  INITIALIZATION: 'ponto-initialization',
  LOCALIZACAO: 'ponto-localizacao',
  OPERACOES: 'ponto-operacoes',
  EXECUCAO: 'ponto-execucao'
};