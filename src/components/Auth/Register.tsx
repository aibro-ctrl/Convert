import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { toast } from '../ui/sonner';
import { Eye, EyeOff } from 'lucide-react';

interface RegisterProps {
  onSwitchToLogin: () => void;
}

export function Register({ onSwitchToLogin }: RegisterProps) {
  const { signup } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const isWeakPassword = (password: string): boolean => {
    // Check for simple sequential numbers
    const simplePatterns = [
      '12345678', '87654321', '11111111', '00000000',
      'password', 'qwerty12', '123456789'
    ];
    
    const lowerPass = password.toLowerCase();
    return simplePatterns.some(pattern => lowerPass.includes(pattern));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Некорректный email', {
        description: 'Введите правильный email адрес (например: user@example.com)'
      });
      return;
    }

    // Validate username length
    if (username.length < 3) {
      toast.error('Некорректное имя пользователя', {
        description: 'Имя должно содержать минимум 3 символа'
      });
      return;
    }

    // Check for special characters in username
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(username)) {
      toast.error('Некорректное имя пользователя', {
        description: 'Используйте только буквы, цифры, дефис и подчеркивание'
      });
      return;
    }

    // Validate password length
    if (password.length < 8) {
      toast.error('Слабый пароль', {
        description: 'Пароль должен содержать минимум 8 символов'
      });
      return;
    }

    // Check for weak passwords
    if (isWeakPassword(password)) {
      toast.error('Слабый пароль', {
        description: 'Избегайте простых комбинаций типа "12345678" или "password"'
      });
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Пароли не совпадают', {
        description: 'Убедитесь, что оба пароля введены одинаково'
      });
      return;
    }

    setLoading(true);

    try {
      console.log('Starting registration...');
      await signup(email, password, username);
      console.log('Registration successful, user should be set in context');
      toast.success('Регистрация успешна!', {
        description: 'Добро пожаловать в Конверт!'
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      const errorMessage = error.message || 'Ошибка регистрации';
      
      // Check specific error types
      if (errorMessage.includes('Email уже используется') || errorMessage.includes('email уже существует')) {
        toast.error('Email уже зарегистрирован', {
          description: 'Этот email уже используется. Попробуйте войти или используйте другой email.',
          duration: 5000
        });
      } else if (errorMessage.includes('Имя пользователя уже занято') || errorMessage.includes('уже занято')) {
        toast.error('Никнейм занят', {
          description: 'Это имя пользователя уже используется. Выберите другое имя.',
          duration: 5000
        });
      } else {
        toast.error('Ошибка регистрации', {
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
        <CardTitle>Регистрация в Конверт</CardTitle>
        <CardDescription>Создайте новую учетную запись</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Имя пользователя</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="username"
              autoComplete="username"
            />
          </div>
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
                autoComplete="new-password"
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
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="••••••••"
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </Button>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Уже есть аккаунт?{' '}
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="text-primary hover:underline"
              >
                Войти
              </button>
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}