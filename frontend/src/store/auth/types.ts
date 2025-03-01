export type AuthErrorType = 'invalid_credentials' | 'network' | 'runtime' | 'blocked';

// Import the RetryStatus type from the initialization queue
import { RetryStatus } from '@/lib/initializationQueue';

export interface AuthError {
  type: AuthErrorType;
  message: string;
}

export interface Credentials {
  Username: string | null;
  Password: string | null;
}

export interface SavedCredentials {
  Username: string;
  Password: string;
}

// Define the retry status for auth tasks
export interface AuthRetryStatus {
  initialization: RetryStatus | { isRetrying: boolean; retryAttempt: number; maxRetries: number; };
  verification: RetryStatus | { isRetrying: boolean; retryAttempt: number; maxRetries: number; };
  login: RetryStatus | { isRetrying: boolean; retryAttempt: number; maxRetries: number; };
  isRetrying: boolean;
  active: RetryStatus | null;
}

export interface AuthState {
  username: string | null;
  lastKnownUsername: string | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: AuthError | null;
  
  // Methods
  formatDisplayName: (name: string) => string;
  initialize: () => Promise<void>;
  verifyCredentials: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUnauthenticated: (error?: AuthError) => void;
  setLoading: (loading: boolean) => void;
  clearError: () => void;
} 