import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, themes } from '../../contexts/ThemeContext';
import { usersAPI } from '../../utils/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { toast } from '../ui/sonner';
import { Settings, Lock, Mail, User, Eye, EyeOff, Palette } from '../ui/icons';
import { Checkbox } from '../ui/checkbox';

export function ProfileSettings() {
  const { user, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();
  
  // Password change
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  
  // Email change
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  
  // Profile fields
  const [displayName, setDisplayName] = useState((user as any)?.display_name || '');
  const [gender, setGender] = useState((user as any)?.gender || '');
  const [age, setAge] = useState((user as any)?.age || '');
  const [interests, setInterests] = useState((user as any)?.interests || '');
  
  // Privacy settings
  const [privacySettings, setPrivacySettings] = useState((user as any)?.privacySettings || {
    showGender: true,
    showAge: true,
    showInterests: true,
  });

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('Пароли не совпадают');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Пароль должен содержать минимум 6 символов');
      return;
    }

    try {
      await usersAPI.changePassword(oldPassword, newPassword);
      toast.success('Пароль успешно изменен');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Ошибка смены пароля');
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newEmail || !emailPassword) {
      toast.error('Заполните все поля');
      return;
    }

    try {
      const result = await usersAPI.changeEmail(newEmail, emailPassword);
      toast.success('Email успешно изменен');
      setNewEmail('');
      setEmailPassword('');
      if (result.user) {
        await refreshUser();
      }
    } catch (error: any) {
      toast.error(error.message || 'Ошибка смены email');
    }
  };

  const handleUpdateProfile = async () => {
    try {
      await usersAPI.updateProfile({
        display_name: displayName || undefined,
        gender: gender || undefined,
        age: age ? parseInt(age) : undefined,
        interests: interests || undefined,
        privacySettings,
      });
      toast.success('Профиль обновлен');
      await refreshUser();
    } catch (error: any) {
      toast.error(error.message || 'Ошибка обновления профиля');
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="w-6 h-6" />
        <h2 className="text-2xl">Настройки</h2>
      </div>

      <Tabs defaultValue="theme" className="w-full">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="theme">
            <Palette className="w-4 h-4 mr-2" />
            Тема
          </TabsTrigger>
          <TabsTrigger value="profile">
            <User className="w-4 h-4 mr-2" />
            Профиль
          </TabsTrigger>
          <TabsTrigger value="password">
            <Lock className="w-4 h-4 mr-2" />
            Пароль
          </TabsTrigger>
          <TabsTrigger value="email">
            <Mail className="w-4 h-4 mr-2" />
            Email
          </TabsTrigger>
        </TabsList>

        <TabsContent value="theme" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Цветовая тема</CardTitle>
              <CardDescription>Выберите тему оформления приложения</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {themes.map((t) => (
                <div
                  key={t.value}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    theme === t.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setTheme(t.value)}
                >
                  <div className="flex items-center justify-between">
                    <span>{t.label}</span>
                    {theme === t.value && (
                      <div className="w-4 h-4 rounded-full bg-primary" />
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Информация о себе</CardTitle>
              <CardDescription>Дополнительные поля профиля</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Отображаемое имя</Label>
                <Input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ваше имя (может быть на русском)"
                />
                <p className="text-xs text-muted-foreground">
                  Упоминания в чате будут работать по логину @{user?.username}, но отображаться будет это имя
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender">Пол</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="Выберите пол" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Не указано</SelectItem>
                    <SelectItem value="male">Мужской</SelectItem>
                    <SelectItem value="female">Женский</SelectItem>
                    <SelectItem value="other">Другой</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2 mt-1">
                  <Checkbox
                    id="showGender"
                    checked={privacySettings.showGender}
                    onCheckedChange={(checked) =>
                      setPrivacySettings({ ...privacySettings, showGender: !!checked })
                    }
                  />
                  <Label htmlFor="showGender" className="text-sm text-muted-foreground cursor-pointer">
                    Показывать другим пользователям
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="age">Возраст</Label>
                <Input
                  id="age"
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="Ваш возраст"
                  min="1"
                  max="120"
                />
                <div className="flex items-center gap-2 mt-1">
                  <Checkbox
                    id="showAge"
                    checked={privacySettings.showAge}
                    onCheckedChange={(checked) =>
                      setPrivacySettings({ ...privacySettings, showAge: !!checked })
                    }
                  />
                  <Label htmlFor="showAge" className="text-sm text-muted-foreground cursor-pointer">
                    Показывать другим пользователям
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="interests">Интересы</Label>
                <Input
                  id="interests"
                  value={interests}
                  onChange={(e) => setInterests(e.target.value)}
                  placeholder="Хобби, интересы..."
                />
                <div className="flex items-center gap-2 mt-1">
                  <Checkbox
                    id="showInterests"
                    checked={privacySettings.showInterests}
                    onCheckedChange={(checked) =>
                      setPrivacySettings({ ...privacySettings, showInterests: !!checked })
                    }
                  />
                  <Label htmlFor="showInterests" className="text-sm text-muted-foreground cursor-pointer">
                    Показывать другим пользователям
                  </Label>
                </div>
              </div>

              <Button onClick={handleUpdateProfile} className="w-full">
                Сохранить изменения
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="password" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Сменить пароль</CardTitle>
              <CardDescription>Измените пароль для входа в аккаунт</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="oldPassword">Текущий пароль</Label>
                  <div className="relative">
                    <Input
                      id="oldPassword"
                      type={showPasswords ? 'text' : 'password'}
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">Новый пароль</Label>
                  <Input
                    id="newPassword"
                    type={showPasswords ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Подтвердите новый пароль</Label>
                  <Input
                    id="confirmPassword"
                    type={showPasswords ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="showPasswords"
                    checked={showPasswords}
                    onCheckedChange={(checked) => setShowPasswords(!!checked)}
                  />
                  <Label htmlFor="showPasswords" className="text-sm cursor-pointer">
                    Показать пароли
                  </Label>
                </div>

                <Button type="submit" className="w-full">
                  Изменить пароль
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Сменить Email</CardTitle>
              <CardDescription>
                Текущий email: <strong>{user?.email}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangeEmail} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newEmail">Новый email</Label>
                  <Input
                    id="newEmail"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                    placeholder="new@email.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emailPassword">Подтвердите паролем</Label>
                  <Input
                    id="emailPassword"
                    type="password"
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    required
                  />
                </div>

                <Button type="submit" className="w-full">
                  Изменить Email
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
