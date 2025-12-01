import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { toast } from '../ui/sonner';
import { Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  onSwitchToRegister: () => void;
}

export function Login({ onSwitchToRegister }: LoginProps) {
  const { signin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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
      
      // Обработка ошибок
      if (errorMessage.includes('Неверный email или пароль')) {
        toast.error('Неверный email или пароль', {
          description: 'Проверьте правильность введенных данных',
          duration: 5000
        });
      } else if (errorMessage.includes('Email уже используется')) {
        toast.error('Email уже используется', {
          description: 'Этот email уже зарегистрирован',
          duration: 5000
        });
      } else if (errorMessage.includes('забанен') || errorMessage.includes('banned')) {
        toast.error('Доступ заблокирован', {
          description: 'Ваш аккаунт был заблокирован администратором'
        });
      } else {
        toast.error('Ошибка входа', {
          description: errorMessage,
          duration: 5000
        });
      }
    } finally {
      setLoading(false);
    }
  };

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
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Пароль</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                autoComplete="current-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
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