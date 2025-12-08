import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { toast } from '../ui/sonner';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { Trash2, RefreshCw, CheckCircle, XCircle, Database } from '../ui/icons';
import { adminAPI } from '../../utils/api';

interface UserInfo {
  id: string;
  email: string;
  created_at: string;
  in_auth: boolean;
  in_kv: boolean;
  username: string;
  role: string;
}

export function DevPanel() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creatingTest, setCreatingTest] = useState(false);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [clearingData, setClearingData] = useState(false);

  useEffect(() => {
    checkServerHealth();
    loadUsers();
  }, []);

  const checkServerHealth = async () => {
    try {
      console.log('Checking server health...');
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b0f1e6d5/health`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log('Server health check:', data);
        setServerStatus('online');
        toast.success('Сервер доступен', { description: 'Edge Function работает нормально' });
      } else {
        console.error('Server health check failed:', response.status);
        setServerStatus('offline');
        toast.error('Сервер недоступен', { 
          description: `HTTP ${response.status}. Проверьте Edge Function.`,
          duration: 10000
        });
      }
    } catch (error: any) {
      console.error('Server health check error:', error);
      setServerStatus('offline');
      toast.error('Не удалось подключиться к серверу', {
        description: 'Проверьте, запущен ли Edge Function',
        duration: 10000
      });
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b0f1e6d5/auth/list-users`,
        {
          headers: {
            'Authorization': `Bearer ${token || publicAnonKey}`,
          },
        }
      );

      const data = await response.json();

      if (response.ok) {
        setUsers(data.users || []);
      } else {
        toast.error('Ошибка загрузки пользователей');
      }
    } catch (error: any) {
      toast.error('Ошибка: ' + error.message);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCreateTestUser = async () => {
    if (users.some(u => u.email === 'test@example.com')) {
      toast.info('Тестовый пользователь уже существует');
      return;
    }

    setCreatingTest(true);
    try {
      console.log('Creating test user...');
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b0f1e6d5/auth/signup`,
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

      console.log('Create test user response status:', response.status);
      const contentType = response.headers.get('content-type');
      console.log('Response content-type:', contentType);

      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error('Non-JSON response:', text.substring(0, 200));
        throw new Error(`Server returned non-JSON response: ${response.status}`);
      }

      if (response.ok) {
        console.log('Test user created successfully');
        toast.success('Тестовый пользователь создан!', {
          description: 'Email: test@example.com | Пароль: test12345678'
        });
        loadUsers();
      } else {
        console.error('Create test user error:', data);
        if (data.error?.includes('уже существует') || data.error?.includes('уже занято')) {
          toast.info('Тестовый пользователь уже существует');
          loadUsers();
        } else {
          toast.error(data.error || 'Ошибка создания');
        }
      }
    } catch (error: any) {
      console.error('Create test user exception:', error);
      toast.error('Ошибка: ' + error.message);
    } finally {
      setCreatingTest(false);
    }
  };

  const handleDeleteUser = async (emailToDelete?: string) => {
    const targetEmail = emailToDelete || email;
    
    if (!targetEmail.trim()) {
      toast.error('Введите email для удаления');
      return;
    }

    if (!confirm(`Вы уверены, что хотите удалить пользователя с email ${targetEmail}?`)) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b0f1e6d5/auth/delete-user/${encodeURIComponent(targetEmail)}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      const data = await response.json();

      if (response.ok) {
        toast.success('Пользователь успешно удален');
        setEmail('');
        loadUsers(); // Refresh list
      } else {
        if (data.error.includes('не найден')) {
          toast.info('Пользователь не найден - возможно, уже удален');
        } else {
          toast.error(data.error || 'Ошибка удаления');
        }
      }
    } catch (error: any) {
      toast.error('Ошибка при удалении: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-900/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              🛠️ Панель разработчика
            </CardTitle>
            <CardDescription>
              Инструменты для тестирования и отладки
            </CardDescription>
          </div>
          <Button
            onClick={loadUsers}
            disabled={loadingUsers}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Server Status */}
        <div className="p-3 rounded-lg border" style={{
          backgroundColor: serverStatus === 'online' ? 'rgba(34, 197, 94, 0.1)' : serverStatus === 'offline' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(234, 179, 8, 0.1)',
          borderColor: serverStatus === 'online' ? 'rgb(34, 197, 94)' : serverStatus === 'offline' ? 'rgb(239, 68, 68)' : 'rgb(234, 179, 8)'
        }}>
          <div className="flex items-center gap-2">
            {serverStatus === 'online' ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : serverStatus === 'offline' ? (
              <XCircle className="w-5 h-5 text-red-600" />
            ) : (
              <RefreshCw className="w-5 h-5 text-yellow-600 animate-spin" />
            )}
            <div>
              <p className="text-sm">
                Статус сервера: <span className="font-medium">
                  {serverStatus === 'online' ? 'В сети' : serverStatus === 'offline' ? 'Недоступен' : 'Проверка...'}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                Edge Function: make-server-b0f1e6d5
              </p>
            </div>
          </div>
        </div>

        <div className="h-px bg-border" />
        
        {/* Clear Database Button */}
        <div className="space-y-2">
          <Button
            onClick={async () => {
              if (!confirm('⚠️ ВНИМАНИЕ! Это удалит ВСЕ сообщения, комнаты (кроме системных) и файлы из базы данных. Пользователи останутся. Продолжить?')) {
                return;
              }
              
              setClearingData(true);
              try {
                const result = await adminAPI.clearData();
                toast.success('База данных очищена!', {
                  description: `Удалено: ${result.stats.deletedMessages} сообщений, ${result.stats.deletedRooms} комнат, ${result.stats.deletedDMs} личных чатов`,
                  duration: 5000
                });
                
                // Перезагрузить страницу для обновления
                setTimeout(() => window.location.reload(), 2000);
              } catch (error: any) {
                console.error('Clear data error:', error);
                toast.error('Ошибка очистки: ' + error.message);
              } finally {
                setClearingData(false);
              }
            }}
            disabled={clearingData}
            className="w-full"
            variant="destructive"
          >
            <Database className="w-4 h-4 mr-2" />
            {clearingData ? 'Очистка...' : '🗑️ Очистить базу данных (сообщения и файлы)'}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Удаляет все сообщения, комнаты и файлы. Пользователи сохраняются.
          </p>
        </div>

        <div className="h-px bg-border" />
        
        {/* Clear LocalStorage Button */}
        <div className="space-y-2">
          <Button
            onClick={() => {
              if (confirm('Очистить все данные в localStorage? Это выйдет вас из системы.')) {
                localStorage.clear();
                toast.success('LocalStorage очищен');
                window.location.reload();
              }
            }}
            className="w-full"
            variant="outline"
          >
            🗑️ Очистить localStorage (решение проблем с токеном)
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Используйте при ошибках "Invalid token" или "missing sub claim"
          </p>
        </div>

        <div className="h-px bg-border" />

        {/* Quick Test User Creation */}
        <div className="space-y-2">
          <Button
            onClick={handleCreateTestUser}
            disabled={creatingTest}
            className="w-full"
            variant="outline"
          >
            {creatingTest ? 'Создание...' : '✨ Создать тестового пользователя'}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Email: test@example.com | Пароль: test12345678
          </p>
        </div>

        <div className="h-px bg-border" />

        {/* User List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              Зарегистрированные пользователи ({users.length})
            </label>
          </div>
          
          {loadingUsers ? (
            <div className="text-center py-4 text-muted-foreground">
              Загрузка...
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              Пользователи не найдены
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{user.email}</p>
                      <div className="flex gap-1">
                        <span title={user.in_auth ? 'В Auth' : 'Не в Auth'}>
                          {user.in_auth ? (
                            <CheckCircle className="w-3 h-3 text-green-500" />
                          ) : (
                            <XCircle className="w-3 h-3 text-red-500" />
                          )}
                        </span>
                        <span title={user.in_kv ? 'В KV' : 'Не в KV'}>
                          {user.in_kv ? (
                            <CheckCircle className="w-3 h-3 text-blue-500" />
                          ) : (
                            <XCircle className="w-3 h-3 text-red-500" />
                          )}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      @{user.username} • {user.role}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleDeleteUser(user.email)}
                    disabled={loading}
                    size="sm"
                    variant="ghost"
                    className="ml-2"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="h-px bg-border" />

        {/* Manual Delete */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Удалить пользователя вручную
          </label>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button
              onClick={() => handleDeleteUser()}
              disabled={loading}
              variant="destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {loading ? 'Удаление...' : 'Удалить'}
            </Button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
          <p><strong>Легенда:</strong></p>
          <p>• <CheckCircle className="w-3 h-3 inline text-green-500" /> Зеленая галочка = в Supabase Auth</p>
          <p>• <CheckCircle className="w-3 h-3 inline text-blue-500" /> Синяя галочка = в KV хранилище</p>
          <p>• Удаление очищает оба хранилища</p>
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
            <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">📝 Для тестирования:</p>
            <p className="text-blue-800 dark:text-blue-200">Если список пуст, создайте пользователя через форму регистрации.</p>
            <p className="text-blue-800 dark:text-blue-200 mt-1">Тестовые данные: email@test.com / password123</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
