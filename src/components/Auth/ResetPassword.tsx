import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { toast } from '../ui/sonner';
import { supabase } from '../../utils/supabase/client';

interface ResetPasswordProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function ResetPassword({ onSuccess, onCancel }: ResetPasswordProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);

  useEffect(() => {
    // Check if there's a valid recovery session
    checkRecoverySession();
  }, []);

  const checkRecoverySession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setIsValidSession(true);
      } else {
        toast.error('Ссылка недействительна', {
          description: 'Пожалуйста, запросите новую ссылку для восстановления пароля'
        });
        setTimeout(onCancel, 2000);
      }
    } catch (error) {
      console.error('Error checking session:', error);
      toast.error('Ошибка проверки сессии');
      setTimeout(onCancel, 2000);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword.trim() || !confirmPassword.trim()) {
      toast.error('Заполните все поля', {
        description: 'Введите новый пароль и подтверждение'
      });
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Пароль слишком короткий', {
        description: 'Пароль должен содержать минимум 6 символов'
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Пароли не совпадают', {
        description: 'Введенные пароли должны совпадать'
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        console.error('Update password error:', error);
        toast.error('Ошибка', {
          description: error.message || 'Не удалось обновить пароль'
        });
        return;
      }

      toast.success('Пароль успешно изменен!', {
        description: 'Теперь вы можете войти с новым паролем'
      });

      // Sign out to clear the recovery session
      await supabase.auth.signOut();

      setTimeout(onSuccess, 1000);
    } catch (error: any) {
      console.error('Reset password error:', error);
      toast.error('Ошибка', {
        description: 'Не удалось обновить пароль'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isValidSession) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Проверка...</CardTitle>
          <CardDescription>Проверяем ссылку для восстановления пароля</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Новый пароль</CardTitle>
        <CardDescription>Введите новый пароль для вашей учетной записи</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Новый пароль</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              placeholder="••••••••"
              autoFocus
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Подтвердите пароль</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onCancel}
              disabled={loading}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={loading}
            >
              {loading ? 'Сохранение...' : 'Изменить пароль'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
