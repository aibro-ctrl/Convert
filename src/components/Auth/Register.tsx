import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useConnection } from '../../contexts/ConnectionContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { toast } from '../ui/sonner';

interface RegisterProps {
  onSwitchToLogin: () => void;
}

export function Register({ onSwitchToLogin }: RegisterProps) {
  const { signup } = useAuth();
  const { isOnline, checkConnection } = useConnection();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

    // Проверяем доступность сервера перед попыткой регистрации
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
      console.log('Starting registration...');
      await signup(email, password, username);
      console.log('Registration successful, user should be set in context');
      // Успешная регистрация - пользователь будет автоматически перенаправлен в MainApp
      // Toast будет показан через useToastListener в MainApp
    } catch (error: any) {
      console.error('Registration error:', error);
      const errorMessage = error.message || 'Ошибка регистрации';
      
      // Check specific error types
      if (errorMessage.includes('email уже существует') || 
          errorMessage.includes('Пользователь с таким email') ||
          errorMessage.includes('уже существует') ||
          errorMessage.includes('already exists')) {
        toast.error('Email уже зарегистрирован', {
          description: 'Этот email уже используется. Попробуйте войти или используйте другой email.',
          duration: 5000
        });
      } else if (errorMessage.includes('уже занято') || 
                 errorMessage.includes('Имя пользователя') ||
                 errorMessage.includes('username') && errorMessage.includes('taken')) {
        toast.error('Никнейм занят', {
          description: 'Это имя пользователя уже используется. Выберите другое имя.',
          duration: 5000
        });
      } else if (errorMessage.includes('неверный') || 
                 errorMessage.includes('существует, но пароль') ||
                 errorMessage.includes('Invalid')) {
        toast.error('Email уже зарегистрирован', {
          description: 'Аккаунт с этим email уже существует. Используйте форму входа.',
          duration: 5000
        });
      } else if (errorMessage.includes('Сервер недоступен') || 
                 errorMessage.includes('ERR_CONNECTION_REFUSED')) {
        toast.error('Сервер недоступен', {
          description: 'Не удалось подключиться к серверу. Убедитесь, что сервер запущен и доступен. Проверьте адрес сервера в настройках.',
          duration: 10000
        });
      } else if (errorMessage.includes('Сервер не отвечает') || 
                 errorMessage.includes('Сервер временно недоступен') ||
                 errorMessage.includes('превышено время ожидания') ||
                 errorMessage.includes('504') ||
                 errorMessage.includes('Gateway Time-out')) {
        toast.error('Сервер не отвечает', {
          description: 'Пожалуйста, подождите несколько секунд и попробуйте зарегистрироваться снова. Если проблема сохраняется, проверьте подключение к интернету.',
          duration: 8000
        });
      } else if (errorMessage.includes('Ошибка подключения') || 
                 errorMessage.includes('Network error') ||
                 errorMessage.includes('Failed to fetch')) {
        toast.error('Ошибка подключения', {
          description: 'Не удалось подключиться к серверу. Проверьте подключение к интернету и попробуйте еще раз.',
          duration: 8000
        });
      } else if (errorMessage.includes('Could not query the database') ||
                 errorMessage.includes('schema cache')) {
        toast.error('Ошибка подключения к базе данных', {
          description: 'Проверьте настройки базы данных на сервере. Обратитесь к администратору.',
          duration: 7000
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
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-confirm-password"
                checked={showConfirmPassword}
                onCheckedChange={(checked) => setShowConfirmPassword(checked === true)}
              />
              <Label
                htmlFor="show-confirm-password"
                className="text-sm font-normal cursor-pointer"
              >
                Показать пароль
              </Label>
            </div>
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
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
