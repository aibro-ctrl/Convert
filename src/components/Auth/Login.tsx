import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useConnection } from '../../contexts/ConnectionContext';
import { useCrypto } from '../../contexts/CryptoContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { toast } from '../ui/sonner';
import { supabase } from '../../utils/supabase/client';

interface LoginProps {
  onSwitchToRegister: () => void;
}

export function Login({ onSwitchToRegister }: LoginProps) {
  const { signin } = useAuth();
  const { isOnline, checkConnection } = useConnection();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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

    // Проверяем доступность сервера перед попыткой входа
    if (!isOnline) {
      toast.warning('Сервер недоступен', {
        description: 'Проверяю подключение к серверу...',
        duration: 3000
      });
      
      const serverAvailable = await checkConnection();
      if (!serverAvailable) {
        toast.error('Сервер недоступен', {
          description: 'Не удалось подключиться к серверу. Убедитесь, что сервер запущен и доступен.',
          duration: 10000
        });
        setLoading(false);
        return;
      }
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
      
      // Обработка ошибок таймаута и недоступности сервера
      if (errorMessage.includes('Сервер не отвечает') || 
          errorMessage.includes('Сервер временно недоступен') ||
          errorMessage.includes('превышено время ожидания') ||
          errorMessage.includes('504') ||
          errorMessage.includes('Gateway Time-out')) {
        toast.error('Сервер не отвечает', {
          description: 'Пожалуйста, подождите несколько секунд и попробуйте войти снова. Если проблема сохраняется, проверьте подключение к интернету.',
          duration: 8000
        });
      } else if (errorMessage.includes('Сервер недоступен') || 
                 errorMessage.includes('ERR_CONNECTION_REFUSED')) {
        toast.error('Сервер недоступен', {
          description: 'Не удалось подключиться к серверу. Убедитесь, что сервер запущен и доступен. Проверьте адрес сервера в настройках.',
          duration: 10000
        });
      } else if (errorMessage.includes('Ошибка подключения') || 
                 errorMessage.includes('Network error') ||
                 errorMessage.includes('Failed to fetch')) {
        toast.error('Ошибка подключения', {
          description: 'Не удалось подключиться к серверу. Проверьте подключение к интернету и попробуйте еще раз.',
          duration: 8000
        });
      } else if (errorMessage.includes('Неверный email или пароль') || 
                 errorMessage.includes('Invalid login credentials') || 
                 errorMessage.includes('invalid_credentials')) {
        toast.error('Неверный email или пароль', {
          description: 'Проверьте правильность введенных данных или зарегистрируйтесь.',
          duration: 5000
        });
      } else if (errorMessage.includes('не найден') || errorMessage.includes('Пользователь не найден')) {
        toast.error('Аккаунт не найден', {
          description: 'Пользователь с таким email не зарегистрирован. Зарегистрируйтесь или проверьте email.',
          duration: 5000
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
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-password"
                checked={showPassword}
                onCheckedChange={(checked) => setShowPassword(checked === true)}
              />
              <Label
                htmlFor="show-password"
                className="text-sm font-normal cursor-pointer"
              >
                Показать пароль
              </Label>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Вход...' : 'Войти'}
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