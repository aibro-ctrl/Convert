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

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [godModeEnabled, setGodModeEnabled] = useState(() => {
    return localStorage.getItem('godModeEnabled') === 'true';
  });

  useEffect(() => {
    // Не проверяем auth сразу при монтировании - даем время для сохранения токена после входа
    const timeoutId = setTimeout(() => {
      checkAuth();
    }, 100);
    
    // Автопереподключение каждые 60 секунд если есть токен (увеличили интервал)
    const reconnectInterval = setInterval(() => {
      const token = localStorage.getItem('access_token');
      if (token && !user) {
        console.log('AuthContext: Attempting automatic reconnection...');
        checkAuth();
        setReconnectAttempts(prev => prev + 1);
      }
    }, 60000); // Увеличили с 30 до 60 секунд
    
    return () => {
      clearTimeout(timeoutId);
      clearInterval(reconnectInterval);
    };
  }, [user]);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('access_token');
      
      // Pre-check: validate token format and expiry
      // Используем большой buffer (10 минут) - не выкидываем пользователя слишком рано
      if (token) {
        // Проверяем только критически истекшие токены (более 10 минут)
        if (isTokenExpired(token, 600)) {
          // Пробуем обновить токен вместо выкидывания
          const refreshed = await refreshAuthToken();
          // НЕ очищаем токен даже если не удалось обновить - пользователь остается в приложении
        }
      }
      
      if (token && token.length > 20) { // Check token is not empty or too short
        try {
          const data = await authAPI.getMe();
          setUser(data.user);
        } catch (error: any) {
          // Check if it's a network error
          if (error.message?.includes('Failed to fetch') || 
              error.message?.includes('NetworkError') ||
              error.message?.includes('Network error') ||
              error.message?.includes('timeout')) {
            // Не очищаем токен при сетевых ошибках - пользователь остается в системе
            // Попробуем обновить токен
            const refreshed = await refreshAuthToken();
            if (refreshed) {
              // Если токен обновлен, попробуем еще раз получить пользователя
              try {
                const retryData = await authAPI.getMe();
                setUser(retryData.user);
                setLoading(false);
                return;
              } catch (retryError) {
                // Тихая ошибка - не логируем
              }
            }
            // Оставляем пользователя в системе даже при ошибках
            setUser(null);
          } else if (error.message?.includes('invalid claim') || 
              error.message?.includes('Invalid token') || 
              error.message?.includes('missing sub') ||
              error.message?.includes('expired') ||
              error.message?.includes('Недействительный токен')) {
            // Пробуем обновить токен вместо выкидывания
            const refreshed = await refreshAuthToken();
            if (refreshed) {
              try {
                const retryData = await authAPI.getMe();
                setUser(retryData.user);
                setLoading(false);
                return;
              } catch (retryError) {
                // Тихая ошибка
              }
            }
            // НЕ очищаем токен - пользователь остается в приложении
            setUser(null);
          } else {
            // For other errors, не удаляем токен - пользователь остается в системе
            setUser(null);
          }
        }
      } else {
        console.log('AuthContext: No valid token found, user will be null');
        if (token) {
          // Проверяем длину токена перед удалением
          if (token.length < 20) {
            console.log('AuthContext: Removing invalid short token (length:', token.length, ')');
            localStorage.removeItem('access_token');
          } else {
            console.log('AuthContext: Token exists but getMe failed, keeping token for retry (length:', token.length, ')');
            // НЕ удаляем токен - возможно это временная ошибка сети
          }
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
      console.log('AuthContext: Signin response:', {
        hasAccessToken: !!data.access_token,
        hasRefreshToken: !!data.refresh_token,
        hasUser: !!data.user,
        tokenLength: data.access_token?.length || 0
      });
      
      if (!data.access_token) {
        console.error('AuthContext: No access_token in response:', data);
        throw new Error('Не получен токен доступа');
      }
      
      // Сохраняем токены
      console.log('AuthContext: Saving tokens to localStorage');
      localStorage.setItem('access_token', data.access_token);
      console.log('AuthContext: access_token saved, length:', data.access_token.length);
      
      if (data.refresh_token) {
        localStorage.setItem('refresh_token', data.refresh_token);
        console.log('AuthContext: refresh_token saved');
      }
      
      // Проверяем, что токен действительно сохранен
      const savedToken = localStorage.getItem('access_token');
      if (!savedToken || savedToken !== data.access_token) {
        console.error('AuthContext: Token was not saved correctly!', {
          expected: data.access_token.substring(0, 20) + '...',
          got: savedToken ? savedToken.substring(0, 20) + '...' : 'null'
        });
        throw new Error('Ошибка сохранения токена');
      }
      
      console.log('AuthContext: Token verified in localStorage');
      
      // Устанавливаем пользователя ПЕРЕД инициализацией E2EE
      if (data.user) {
        setUser(data.user);
        console.log('AuthContext: User set:', data.user.username);
      } else {
        console.warn('AuthContext: No user data in response, trying to get user from /auth/me');
        // Если нет user в ответе, пробуем получить его через /auth/me
        try {
          const meData = await authAPI.getMe();
          if (meData.user) {
            setUser(meData.user);
            console.log('AuthContext: User retrieved from /auth/me:', meData.user.username);
          }
        } catch (meError) {
          console.error('AuthContext: Failed to get user from /auth/me:', meError);
        }
      }
      
      // Инициализация E2EE ключей после успешного входа
      // CryptoContext инициализирует ключи автоматически через useEffect при появлении user
      // Используем пароль для расшифровки приватного ключа
      localStorage.setItem('temp_password', password);
      setTimeout(() => localStorage.removeItem('temp_password'), 5000); // Удаляем через 5 сек
      
      console.log('AuthContext: Signin completed successfully');
      
      // Проверяем финальное состояние через небольшую задержку
      setTimeout(() => {
        const finalToken = localStorage.getItem('access_token');
        const currentUser = data.user;
        console.log('AuthContext: Final state after signin (delayed check):', {
          hasToken: !!finalToken,
          tokenLength: finalToken?.length || 0,
          hasUser: !!currentUser,
          username: currentUser?.username || 'none'
        });
      }, 500);
    } catch (error) {
      console.error('AuthContext: Signin error:', error);
      throw error;
    }
  };

  const signup = async (email: string, password: string, username: string) => {
    try {
      console.log('AuthContext: Calling signup API', { email, username });
      const data = await authAPI.signup(email, password, username);
      console.log('AuthContext: Signup response:', data);
      
      if (!data || !data.access_token) {
        const errorMsg = data?.error || 'Не получен токен доступа';
        console.error('AuthContext: Signup failed - no token:', errorMsg);
        throw new Error(errorMsg);
      }
      
      localStorage.setItem('access_token', data.access_token);
      if (data.refresh_token) {
        localStorage.setItem('refresh_token', data.refresh_token);
      }
      setUser(data.user);
      
      // Инициализация E2EE ключей для нового пользователя
      // Сохраняем пароль временно для генерации ключей
      localStorage.setItem('temp_password', password);
      setTimeout(() => localStorage.removeItem('temp_password'), 5000);
    } catch (error: any) {
      console.error('AuthContext: Signup error:', error);
      // Пробрасываем ошибку дальше с понятным сообщением
      const errorMessage = error?.message || error?.error || 'Ошибка регистрации';
      throw new Error(errorMessage);
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
    // Очищаем сессионный ключ шифрования (удаляется из sessionStorage)
    // Это произойдет автоматически при перезагрузке страницы, но можно очистить явно
    sessionStorage.removeItem('session_encryption_key');
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

  // Обновляем последнюю активность каждые 2 минуты (увеличили интервал)
  useEffect(() => {
    if (!user) return;
    
    updateLastActivity(); // Сразу при монтировании
    
    const interval = setInterval(updateLastActivity, 120000); // Каждые 2 минуты
    
    // Отслеживаем активность пользователя с debounce (только раз в 30 секунд)
    let activityTimeout: NodeJS.Timeout;
    const handleActivity = () => {
      clearTimeout(activityTimeout);
      activityTimeout = setTimeout(() => {
        updateLastActivity();
      }, 30000); // Debounce 30 секунд
    };
    
    window.addEventListener('click', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity, { passive: true });
    
    return () => {
      clearInterval(interval);
      clearTimeout(activityTimeout);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
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