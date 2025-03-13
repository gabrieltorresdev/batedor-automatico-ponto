import { LoginPonto, VerificarCredenciaisSalvas, CarregarCredenciais } from '../../../wailsjs/go/main/App';
import { withRuntime } from '@/lib/wailsRuntime';
import { authQueue } from '@/lib/initializationQueue';
import { AuthState, AuthError, SavedCredentials, Credentials } from './types';
import { determineErrorType, extractErrorMessage } from './utils';

export const AUTH_TASK_KEYS = {
  INITIALIZATION: 'auth-initialization',
  VERIFICATION: 'auth-verification',
  LOGIN: 'auth-login'
};

export const initialize = async (
  set: (state: Partial<AuthState>) => void,
  get: () => AuthState
): Promise<void> => {
  const state = get();
  if (state.isInitialized || state.isLoading) return;

  return authQueue.enqueue(async () => {
    try {
      set({ isLoading: true, error: null });
      
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

      await verifyCredentials(set, get);
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
  }, AUTH_TASK_KEYS.INITIALIZATION);
};

export const verifyCredentials = async (
  set: (state: Partial<AuthState>) => void,
  get: () => AuthState
): Promise<void> => {
  return authQueue.enqueue(async () => {
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
  }, AUTH_TASK_KEYS.VERIFICATION);
};

export const login = async (
  username: string,
  password: string,
  set: (state: Partial<AuthState>) => void,
  get: () => AuthState
): Promise<void> => {
  const state = get();
  if (state.isLoading) return;

  return authQueue.enqueue(async () => {
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
  }, AUTH_TASK_KEYS.LOGIN);
};

export const logout = async (
  set: (state: Partial<AuthState>) => void
): Promise<void> => {
  set({
    username: null,
    isInitialized: false,
    isLoading: false,
    error: null
  });
};