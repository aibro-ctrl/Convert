import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCrypto } from '../../contexts/CryptoContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { toast } from '../ui/sonner';
import { supabaseUrl, publicAnonKey } from '../../utils/supabase/info';
import { supabase } from '../../utils/supabase/client';

interface LoginProps {
  onSwitchToRegister: () => void;
}

export function Login({ onSwitchToRegister }: LoginProps) {
  const { signin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [creatingTestUser, setCreatingTestUser] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  
  // Forgot password states
  const [resetEmail, setResetEmail] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  const handleRequestPasswordReset = async () => {
    if (!resetEmail.trim()) {
      toast.error('Введите email', {
        description: 'Пожалуйста, введите ваш email для восстановления пароля'
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(resetEmail)) {
      toast.error('Некорректный email', {
        description: 'Введите правильный email адрес'
      });
      return;
    }

    setResettingPassword(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/#reset-password`,
      });

      if (error) {
        console.error('Reset password error:', error);
        toast.error('Ошибка', {
          description: error.message || 'Не удалось отправить письмо для восстановления пароля'
        });
        return;
      }

      toast.success('Письмо отправлено!', {
        description: `Проверьте ваш email ${resetEmail}. Мы отправили ссылку для восстановления пароля.`,
        duration: 10000
      });

      // Go back to login
      setShowForgotPassword(false);
      setResetEmail('');
    } catch (error: any) {
      console.error('Request password reset error:', error);
      toast.error('Ошибка', {
        description: 'Не удалось отправить запрос на восстановление пароля'
      });
    } finally {
      setResettingPassword(false);
    }
  };

  const handleCancelReset = () => {
    setShowForgotPassword(false);
    setResetEmail('');
  };

  const handleQuickTestLogin = async () => {
    setCreatingTestUser(true);
    
    // First, clear any potentially bad tokens
    localStorage.clear();
    
    try {
      // Try to create test user first (use anon key for Supabase Edge Functions)
      const createResponse = await fetch(
        `${supabaseUrl}/functions/v1/make-server-b0f1e6d5/auth/signup`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'test12345678',
            username: 'testuser',
          }),
        }
      );

      const createData = await createResponse.json();
      
      if (createResponse.ok) {
        console.log('Test user created successfully');
        toast.success('Тестовый пользователь создан!', {
          description: 'Автоматический вход...'
        });
      } else if (createData.error?.includes('уже существует') || createData.error?.includes('уже занято')) {
        // User exists, that's fine
        console.log('Test user already exists, logging in...');
      } else {
        // Log the error but continue to try login
        console.log('Create test user response:', createData);
      }

      // Now try to log in
      await signin('test@example.com', 'test12345678');
      toast.success('Добро пожаловать!', {
        description: 'Вы вошли как тестовый пользователь'
      });
    } catch (error: any) {
      console.error('Quick test login error:', error);
      toast.error('Ошибка быстрого входа', {
        description: error.message || 'Попробуйте создать пользователя через панель разработчика (⚙️)'
      });
    } finally {
      setCreatingTestUser(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Некорректный email', {
        description: 'Введите правильный email адрес'
      });
      return;
    }

    // Validate password
    if (password.length < 6) {
      toast.error('Некорректный пароль', {
        description: 'Пароль слишком короткий'
      });
      return;
    }

    setLoading(true);

    try {
      console.log('Starting login with email:', email);
      await signin(email, password);
      toast.success('Добро пожаловать в Конверт!', {
        description: 'Вы успешно вошли в систему'
      });
    } catch (error: any) {
      console.error('Login error:', error);
      const errorMessage = error.message || 'Ошибка входа';
      
      // Display the error message from the server
      if (errorMessage.includes('Неверный email или пароль') || errorMessage.includes('Invalid login credentials') || errorMessage.includes('invalid_credentials')) {
        toast.error('Пользователь не найден', {
          description: '❌ Аккаунт с таким email не существует. Нажмите "🚀 Быстрый вход" ниже или зарегистрируйтесь.',
          duration: 7000
        });
      } else if (errorMessage.includes('не найден') || errorMessage.includes('Пользователь не найден')) {
        toast.error('Аккаунт не найден', {
          description: '❌ Пользователь с таким email не зарегистрирован. Используйте "🚀 Быстрый вход" или создайте новый аккаунт.',
          duration: 7000
        });
      } else if (errorMessage.includes('Email не подтвержден')) {
        toast.error('Email не подтвержден', {
          description: 'Пожалуйста, подтвердите ваш email адрес'
        });
      } else if (errorMessage.includes('забанен') || errorMessage.includes('banned')) {
        toast.error('Доступ заблокирован', {
          description: 'Ваш аккаунт был заблокирован администратором'
        });
      } else {
        toast.error('Ошибка входа', {
          description: errorMessage,
          duration: 7000
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (showForgotPassword) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Восстановление пароля</CardTitle>
          <CardDescription>
            Введите ваш email, и мы отправим ссылку для восстановления пароля
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="your@email.com"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !resettingPassword) {
                    handleRequestPasswordReset();
                  }
                }}
              />
            </div>
            
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <p className="text-xs text-muted-foreground">
                ℹ️ Убедитесь, что вы настроили восстановление пароля в настройках Supabase Auth
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleCancelReset}
                disabled={resettingPassword}
              >
                Отмена
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={handleRequestPasswordReset}
                disabled={resettingPassword}
              >
                {resettingPassword ? 'Отправка...' : 'Отправить ссылку'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Вход в Конверт</CardTitle>
        <CardDescription>Войдите в свою учетную запись</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Пароль</Label>
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(true);
                  setResetEmail(email);
                }}
                className="text-xs text-primary hover:underline"
              >
                Забыли пароль?
              </button>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || creatingTestUser}>
            {loading ? 'Вход...' : 'Войти'}
          </Button>
          
          {/* Quick Test Login Button */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">или</span>
            </div>
          </div>
          
          <Button
            type="button"
            variant="outline"
            className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-300 dark:border-blue-700 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30"
            onClick={handleQuickTestLogin}
            disabled={loading || creatingTestUser}
          >
            {creatingTestUser ? '⏳ Создание и вход...' : '🚀 Быстрый вход (тестовый пользователь)'}
          </Button>
          
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Нет аккаунта?{' '}
              <button
                type="button"
                onClick={onSwitchToRegister}
                className="text-primary hover:underline"
              >
                Зарегистрироваться
              </button>
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}