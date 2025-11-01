import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { toast } from '../ui/sonner';

interface RegisterProps {
  onSwitchToLogin: () => void;
}

export function Register({ onSwitchToLogin }: RegisterProps) {
  const { signup } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
      // Успешная регистрация - пользователь будет автоматически перенаправлен в MainApp
      // Toast будет показан через useToastListener в MainApp
    } catch (error: any) {
      console.error('Registration error:', error);
      const errorMessage = error.message || 'Ошибка регистрации';
      
      // Check specific error types
      if (errorMessage.includes('email уже существует') || errorMessage.includes('Пользователь с таким email')) {
        toast.error('Email уже зарегистрирован', {
          description: 'Этот email уже используется. Попробуйте войти или используйте другой email.'
        });
      } else if (errorMessage.includes('уже занято') || errorMessage.includes('Имя пользователя')) {
        toast.error('Никнейм занят', {
          description: 'Это имя пользователя уже используется. Выберите другое имя.'
        });
      } else if (errorMessage.includes('неверный') || errorMessage.includes('существует, но пароль')) {
        toast.error('Email уже зарегистрирован', {
          description: 'Аккаунт с этим email уже существует. Используйте форму входа.'
        });
      } else if (errorMessage.includes('invalid') || errorMessage.includes('Invalid')) {
        toast.error('Некорректные данные', {
          description: 'Проверьте правильность введенного email адреса'
        });
      } else {
        toast.error('Ошибка регистрации', {
          description: errorMessage
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
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Пароль</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </Button>
          <div className="text-center space-y-2">
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
            
            {/* Helpful tip about test account */}
            <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 text-left">
              <p className="text-xs text-green-900 dark:text-green-100">
                💡 <strong>Для быстрого тестирования:</strong> Нажмите на иконку ⚙️ в правом верхнем углу и создайте тестового пользователя
              </p>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
