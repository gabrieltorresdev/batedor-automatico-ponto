import { create } from 'zustand';
import { LoginPonto, VerificarCredenciaisSalvas, CarregarCredenciais } from '../../wailsjs/go/main/App';
import { withRuntime, RuntimeError } from '@/lib/wailsRuntime';

export type AuthErrorType = 'invalid_credentials' | 'network' | 'runtime' | 'blocked';

interface AuthError {
  type: AuthErrorType;
  message: string;
}

interface Credentials {
  Username: string | null;
  Password: string | null;
}

interface SavedCredentials {
  Username: string;
  Password: string;
}

interface AuthState {
  username: string | null;
  lastKnownUsername: string | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: AuthError | null;
  formatDisplayName: (name: string) => string;
  initialize: () => Promise<void>;
  verifyCredentials: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUnauthenticated: (error?: AuthError) => void;
  setLoading: (loading: boolean) => void;
  clearError: () => void;
}

const determineErrorType = (error: unknown): AuthErrorType => {
  if (error instanceof RuntimeError) {
    return 'runtime';
  }
  
  // Check if the error is a structured error with type and message
  if (typeof error === 'object' && error !== null) {
    // First check if it's a JSON string that needs parsing
    if (typeof (error as any).error === 'string') {
      try {
        // Try to parse the error message as JSON
        const errorObj = JSON.parse((error as any).error);
        if (errorObj && errorObj.type) {
          if (errorObj.type === 'blocked') return 'blocked';
          if (errorObj.type === 'auth') return 'invalid_credentials';
          if (errorObj.type === 'network') return 'network';
        }
      } catch (e) {
        // Not a JSON string, continue with normal processing
      }
    }
    
    // Direct object with type property
    if ('type' in error) {
      const typedError = error as { type: string };
      if (typedError.type === 'blocked') return 'blocked';
      if (typedError.type === 'auth') return 'invalid_credentials';
      if (typedError.type === 'network') return 'network';
    }
  }
  
  // Fallback to string content checking
  const message = String(error).toLowerCase();
  if (message.includes('bloqueado') || message.includes('horário permitido')) {
    return 'blocked';
  }
  if (message.includes('conexão') || message.includes('network')) {
    return 'network';
  }
  return 'invalid_credentials';
};

// Helper function to extract error message
const extractErrorMessage = (error: unknown): string => {
  if (typeof error === 'object' && error !== null) {
    // Check if it's a structured error response
    if (typeof (error as any).error === 'string') {
      try {
        const errorObj = JSON.parse((error as any).error);
        if (errorObj && errorObj.message) {
          return errorObj.message;
        }
      } catch (e) {
        // Not a JSON string
        return (error as any).error || String(error);
      }
    }
    
    // Direct object with message property
    if ('message' in error) {
      return (error as { message: string }).message;
    }
  }
  
  // Fallback to string conversion
  return error instanceof Error ? error.message : String(error);
};

export const useAuthStore = create<AuthState>((set, get) => ({
  username: null,
  lastKnownUsername: null,
  isInitialized: false,
  isLoading: false,
  error: null,
  
  formatDisplayName: (name: string) => {
    return name.split('@')[0].split('.').map(part => 
      part.charAt(0).toUpperCase() + part.slice(1)
    ).join(' ');
  },

  initialize: async () => {
    const state = get();
    if (state.isInitialized || state.isLoading) return;

    try {
      set({ isLoading: true });
      
      const credentials = await withRuntime<SavedCredentials | Credentials>(
        () => CarregarCredenciais(),
        { Username: null, Password: null }
      );

      if (!credentials?.Username) {
        set({
          isInitialized: true,
          isLoading: false,
          error: {
            type: 'invalid_credentials',
            message: 'Credenciais não encontradas'
          }
        });
        return;
      }

      await get().verifyCredentials();
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
  },
  
  verifyCredentials: async () => {
    try {
      set({ isLoading: true, error: null });
      await withRuntime(() => VerificarCredenciaisSalvas());
      set({ isInitialized: true, isLoading: false, error: null });
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
  },
  
  login: async (username: string, password: string) => {
    const state = get();
    if (state.isLoading) return;

    try {
      set({ isLoading: true, error: null });
      await withRuntime(() => LoginPonto(username, password));
      
      set({
        username,
        lastKnownUsername: username,
        isInitialized: true,
        isLoading: false,
        error: null
      });
    } catch (error) {
      const type = determineErrorType(error);
      const message = extractErrorMessage(error);
      
      set({
        isInitialized: true,
        isLoading: false,
        username: null,
        lastKnownUsername: username,
        error: { type, message }
      });
      throw error;
    }
  },
  
  logout: async () => {
    set({
      username: null,
      isInitialized: false,
      isLoading: false,
      error: null
    });
  },
  
  setUnauthenticated: (error?: AuthError) => {
    set({
      username: null,
      lastKnownUsername: get().username || get().lastKnownUsername,
      isInitialized: true,
      isLoading: false,
      error: error || null
    });
  },
  
  setLoading: (loading: boolean) => {
    set(state => ({
      ...state,
      isLoading: loading,
      error: loading ? null : state.error
    }));
  },
  
  clearError: () => {
    set(state => ({ ...state, error: null }));
  }
})); 