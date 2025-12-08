import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabaseUrl, publicAnonKey } from '../utils/supabase/info';

interface ConnectionContextType {
  isOnline: boolean;
  isConnecting: boolean;
  checkConnection: () => Promise<boolean>;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  const checkConnection = useCallback(async () => {
    try {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/make-server-b0f1e6d5/health`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          signal: AbortSignal.timeout(5000), // 5 second timeout
        }
      );
      
      const online = response.ok;
      setIsOnline(online);
      return online;
    } catch (error) {
      setIsOnline(false);
      return false;
    }
  }, []);

  // Проверяем подключение при монтировании
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Периодическая проверка подключения каждые 10 секунд
  useEffect(() => {
    const interval = setInterval(() => {
      checkConnection();
    }, 10000);

    return () => clearInterval(interval);
  }, [checkConnection]);

  // Слушаем события браузера online/offline
  useEffect(() => {
    const handleOnline = () => {
      checkConnection();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkConnection]);

  return (
    <ConnectionContext.Provider value={{ isOnline, isConnecting, checkConnection }}>
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection() {
  const context = useContext(ConnectionContext);
  if (context === undefined) {
    throw new Error('useConnection must be used within a ConnectionProvider');
  }
  return context;
}
