import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { toast } from '../ui/sonner';
import { pb } from '../../utils/pocketbase/client';

interface ResetPasswordProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function ResetPassword({ onSuccess, onCancel }: ResetPasswordProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Введите email адрес');
      return;
    }

    setIsLoading(true);
    
    try {
      await pb.collection('users').requestPasswordReset(email);
      setEmailSent(true);
      toast.success('Инструкции по сбросу пароля отправлены на email');
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast.error(error.message || 'Ошибка при отправке инструкций');
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Проверьте почту</CardTitle>
          <CardDescription>
            Инструкции по сбросу пароля отправлены на {email}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Если письмо не пришло в течение нескольких минут, проверьте папку "Спам".
          </p>
        </CardContent>
        <CardFooter>
          <Button onClick={onSuccess} className="w-full">
            Вернуться к входу
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Восстановление пароля</CardTitle>
        <CardDescription>
          Введите email адрес для получения инструкций по сбросу пароля
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Отправка...' : 'Отправить инструкции'}
          </Button>
          <Button 
            type="button" 
            variant="ghost" 
            className="w-full" 
            onClick={onCancel}
            disabled={isLoading}
          >
            Отмена
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}