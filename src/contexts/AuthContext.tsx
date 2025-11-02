import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, authAPI } from '../utils/api';
import { isTokenExpired, clearStoragePreservingSettings } from '../utils/tokenUtils';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  godModeEnabled: boolean;
  setGodModeEnabled: (enabled: boolean) => void;
  signin: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, username: string) => Promise<void>;
  signout: () => void;
  refreshUser: () => Promise<void>;
  updateLastActivity: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [godModeEnabled, setGodModeEnabled] = useState(() => {
    return localStorage.getItem('godModeEnabled') === 'true';
  });

  useEffect(() => {
    checkAuth();
    
    // Автопереподключение каждые 30 секунд если есть токен
    const reconnectInterval = setInterval(() => {
      const token = localStorage.getItem('access_token');
      if (token && !user) {
        console.log('AuthContext: Attempting automatic reconnection...');
        checkAuth();
        setReconnectAttempts(prev => prev + 1);
      }
    }, 30000);
    
    return () => clearInterval(reconnectInterval);
  }, [user]);

  const checkAuth = async () => {
    try {
      console.log('AuthContext: checkAuth started');
      const token = localStorage.getItem('access_token');
      console.log('AuthContext: Token in localStorage:', token ? token.substring(0, 20) + '...' : 'null');
      
      // Pre-check: validate token format and expiry
      if (token) {
        // Use the centralized token validation
        if (isTokenExpired(token, 0)) {
          console.log('AuthContext: Token is expired - clearing immediately');
          clearStoragePreservingSettings();
          setUser(null);
          setLoading(false);
          return;
        }
        
        // Log token info for debugging
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.exp) {
            const expDate = new Date(payload.exp * 1000);
            const now = new Date();
            const minutesUntilExpiry = Math.floor((expDate.getTime() - now.getTime()) / 1000 / 60);
            console.log(`AuthContext: Token is valid, expires in ${minutesUntilExpiry} minutes (at ${expDate.toISOString()})`);
          }
        } catch (e) {
          console.error('AuthContext: Error parsing token for logging:', e);
        }
      }
      
      if (token && token.length > 20) { // Check token is not empty or too short
        console.log('AuthContext: Fetching user with token');
        try {
          const data = await authAPI.getMe();
          console.log('AuthContext: User data received:', data.user);
          setUser(data.user);
        } catch (error: any) {
          console.error('AuthContext: Token validation failed:', error.message);
          
          // Check if it's a network error
          if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
            console.log('AuthContext: Network error - keeping token for retry');
            // Don't clear token on network errors, just set user to null
            setUser(null);
          } else if (error.message?.includes('invalid claim') || 
              error.message?.includes('Invalid token') || 
              error.message?.includes('missing sub') ||
              error.message?.includes('expired') ||
              error.message?.includes('Недействительный токен')) {
            console.log('AuthContext: Invalid token detected - clearing localStorage');
            clearStoragePreservingSettings();
            setUser(null);
          } else {
            // For other errors, just remove the token
            console.log('AuthContext: Unknown error - removing token');
            localStorage.removeItem('access_token');
            setUser(null);
          }
        }
      } else {
        console.log('AuthContext: No valid token found, user will be null');
        if (token) {
          // Remove invalid token
          console.log('AuthContext: Removing invalid short token');
          localStorage.removeItem('access_token');
        }
      }
    } catch (error: any) {
      console.error('Auth check failed:', error);
      console.log('AuthContext: Clearing localStorage due to error');
      clearStoragePreservingSettings();
      setUser(null);
    } finally {
      console.log('AuthContext: checkAuth completed, loading set to false');
      setLoading(false);
    }
  };

  const signin = async (email: string, password: string) => {
    try {
      console.log('AuthContext: Calling signin API');
      const data = await authAPI.signin(email, password);
      console.log('AuthContext: Signin response:', data);
      
      if (!data.access_token) {
        throw new Error('Не получен токен доступа');
      }
      
      localStorage.setItem('access_token', data.access_token);
      if (data.refresh_token) {
        localStorage.setItem('refresh_token', data.refresh_token);
      }
      setUser(data.user);
    } catch (error) {
      console.error('AuthContext: Signin error:', error);
      throw error;
    }
  };

  const signup = async (email: string, password: string, username: string) => {
    try {
      console.log('AuthContext: Calling signup API');
      const data = await authAPI.signup(email, password, username);
      console.log('AuthContext: Signup response:', data);
      console.log('AuthContext: Access token:', data.access_token);
      console.log('AuthContext: User:', data.user);
      
      if (!data.access_token) {
        console.error('AuthContext: No access token in response!');
        throw new Error('Не получен токен доступа');
      }
      
      localStorage.setItem('access_token', data.access_token);
      if (data.refresh_token) {
        localStorage.setItem('refresh_token', data.refresh_token);
      }
      console.log('AuthContext: Token saved to localStorage');
      
      setUser(data.user);
      console.log('AuthContext: User state updated, should trigger re-render');
    } catch (error) {
      console.error('AuthContext: Signup error:', error);
      throw error;
    }
  };

  const signout = async () => {
    console.log('AuthContext: Signing out');
    try {
      await authAPI.signout(); // Отправляем запрос на сервер для обновления статуса
    } catch (error) {
      console.error('Signout error:', error);
    }
    // Clear all localStorage data while preserving theme
    clearStoragePreservingSettings();
    setGodModeEnabled(false);
    setUser(null);
    // Force page reload to ensure complete logout
    window.location.reload();
  };

  const refreshUser = async () => {
    try {
      const data = await authAPI.getMe();
      console.log('User refreshed:', {
        id: data.user.id,
        username: data.user.username,
        hasAvatar: !!(data.user as any).avatar,
        avatarUrl: (data.user as any).avatar?.substring(0, 100) + '...' || 'none'
      });
      setUser(data.user);
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  const refreshAuthToken = async () => {
    const refresh_token = localStorage.getItem('refresh_token');
    if (!refresh_token) {
      console.log('No refresh token available');
      return false;
    }

    try {
      const data = await authAPI.refreshToken(refresh_token);
      localStorage.setItem('access_token', data.access_token);
      if (data.refresh_token) {
        localStorage.setItem('refresh_token', data.refresh_token);
      }
      console.log('Token refreshed successfully');
      return true;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      return false;
    }
  };

  const updateLastActivity = async () => {
    if (!user) return;
    try {
      await authAPI.updateLastActivity();
    } catch (error: any) {
      // Если токен невалиден или истек, пробуем обновить его
      if (error?.message?.includes('Недействительный токен') || error?.message?.includes('TOKEN_EXPIRED')) {
        console.log('Token expired during activity update, attempting to refresh...');
        const refreshed = await refreshAuthToken();
        if (refreshed) {
          // Пробуем еще раз обновить активность с новым токеном
          try {
            await authAPI.updateLastActivity();
            console.log('Activity updated after token refresh');
          } catch (retryError) {
            console.error('Failed to update activity even after token refresh:', retryError);
          }
        } else {
          console.log('Could not refresh token - user will need to re-login eventually');
        }
      } else {
        console.error('Failed to update last activity:', error);
      }
    }
  };

  // Обновляем последнюю активность каждую минуту
  useEffect(() => {
    if (!user) return;
    
    updateLastActivity(); // Сразу при монтировании
    
    const interval = setInterval(updateLastActivity, 60000); // Каждую минуту
    
    // Отслеживаем активность пользователя
    const handleActivity = () => {
      updateLastActivity();
    };
    
    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('scroll', handleActivity);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, [user]);

  // Сохраняем состояние Глаза Бога
  useEffect(() => {
    localStorage.setItem('godModeEnabled', godModeEnabled.toString());
  }, [godModeEnabled]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      godModeEnabled, 
      setGodModeEnabled,
      signin, 
      signup, 
      signout, 
      refreshUser,
      updateLastActivity
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
