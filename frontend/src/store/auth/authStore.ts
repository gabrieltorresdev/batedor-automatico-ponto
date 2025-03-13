import { create } from 'zustand';
import { AuthState } from './types';
import * as actions from './actions';

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

  initialize: async () => actions.initialize(set, get),
  verifyCredentials: async () => actions.verifyCredentials(set, get),
  login: async (username, password) => actions.login(username, password, set, get),
  logout: async () => actions.logout(set),
  
  setUnauthenticated: (error) => {
    set({
      username: null,
      lastKnownUsername: get().username || get().lastKnownUsername,
      isInitialized: true,
      isLoading: false,
      error: error || null
    });
  },
  
  setLoading: (loading) => {
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