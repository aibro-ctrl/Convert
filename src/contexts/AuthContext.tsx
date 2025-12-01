import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../utils/api';
import pb from '../utils/pocketbase/client';
import { pbAuthService, convertPBUserToUser } from '../utils/pocketbase/services';

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
  const [godModeEnabled, setGodModeEnabled] = useState(() => {
    return localStorage.getItem('godModeEnabled') === 'true';
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      console.log('AuthContext: checkAuth started');
      
      // Проверяем есть ли сохраненная авторизация в PocketBase
      if (pb.authStore.isValid && pb.authStore.model) {
        console.log('AuthContext: Valid PocketBase auth found');
        
        try {
          // Получаем свежие данные пользователя
          const { user: userData } = await pbAuthService.getMe();
          console.log('AuthContext: User data received:', userData);
          setUser(userData);
        } catch (error: any) {
          console.error('AuthContext: Failed to get user data:', error);
          
          // Если ошибка авторизации - очищаем
          if (error.message?.includes('Не авторизован') || error.status === 401) {
            pb.authStore.clear();
            setUser(null);
          }
        }
      } else {
        console.log('AuthContext: No valid PocketBase auth found');
        setUser(null);
      }
    } catch (error: any) {
      console.error('Auth check failed:', error);
      pb.authStore.clear();
      setUser(null);
    } finally {
      console.log('AuthContext: checkAuth completed, loading set to false');
      setLoading(false);
    }
  };

  const signin = async (email: string, password: string) => {
    try {
      console.log('AuthContext: Calling signin API');
      const data = await pbAuthService.signin(email, password);
      console.log('AuthContext: Signin response:', data);
      
      setUser(data.user);
      
      // Сохраняем пароль временно для E2EE
      localStorage.setItem('temp_password', password);
      setTimeout(() => localStorage.removeItem('temp_password'), 5000);
    } catch (error) {
      console.error('AuthContext: Signin error:', error);
      throw error;
    }
  };

  const signup = async (email: string, password: string, username: string) => {
    try {
      console.log('AuthContext: Calling signup API');
      const data = await pbAuthService.signup(email, password, username);
      console.log('AuthContext: Signup response:', data);
      
      setUser(data.user);
      
      // Сохраняем пароль временно для E2EE
      localStorage.setItem('temp_password', password);
      setTimeout(() => localStorage.removeItem('temp_password'), 5000);
    } catch (error) {
      console.error('AuthContext: Signup error:', error);
      throw error;
    }
  };

  const signout = async () => {
    console.log('AuthContext: Signing out');
    try {
      await pbAuthService.signout();
    } catch (error) {
      console.error('Signout error:', error);
    }
    
    // Сохраняем тему перед очисткой
    const theme = localStorage.getItem('theme');
    localStorage.clear();
    if (theme) {
      localStorage.setItem('theme', theme);
    }
    
    setGodModeEnabled(false);
    setUser(null);
    
    // Перезагружаем страницу
    window.location.reload();
  };

  const refreshUser = async () => {
    try {
      const data = await pbAuthService.getMe();
      console.log('User refreshed:', {
        id: data.user.id,
        username: data.user.username,
        hasAvatar: !!data.user.avatar
      });
      setUser(data.user);
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  const updateLastActivity = async () => {
    if (!user) return;
    try {
      await pbAuthService.updateLastActivity();
    } catch (error) {
      console.error('Failed to update last activity:', error);
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