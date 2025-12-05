/**
 * Сессионное шифрование (как в Telegram)
 * 
 * Один ключ на сессию:
 * - Генерируется при входе пользователя
 * - Хранится в sessionStorage (удаляется при закрытии браузера)
 * - Удаляется при выходе из приложения
 * - Все сообщения шифруются только при отправке в базу
 * - В приложении сообщения не зашифрованы (в памяти)
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import * as sessionCrypto from '../utils/sessionCrypto';

interface SessionCryptoContextType {
  isReady: boolean;
  sessionKey: CryptoKey | null;
  encrypt: (content: string) => Promise<string>;
  decrypt: (encryptedContent: string) => Promise<string>;
  clearSession: () => void;
}

const SessionCryptoContext = createContext<SessionCryptoContextType | null>(null);

export function useSessionCrypto() {
  const context = useContext(SessionCryptoContext);
  if (!context) {
    throw new Error('useSessionCrypto must be used within SessionCryptoProvider');
  }
  return context;
}

interface SessionCryptoProviderProps {
  children: React.ReactNode;
}

export function SessionCryptoProvider({ children }: SessionCryptoProviderProps) {
  const { user } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [sessionKey, setSessionKey] = useState<CryptoKey | null>(null);

  // Инициализация сессионного ключа при входе пользователя
  useEffect(() => {
    if (!user) {
      // Очистка при выходе
      clearSession();
      return;
    }

    const initializeSession = async () => {
      try {
        // Пытаемся загрузить существующий ключ из sessionStorage
        let key = await sessionCrypto.loadSessionKey();
        
        if (!key) {
          // Генерируем новый ключ
          console.log('SessionCrypto: Generating new session key...');
          key = await sessionCrypto.generateSessionKey();
          await sessionCrypto.saveSessionKey(key);
          console.log('SessionCrypto: Session key generated and saved');
        } else {
          console.log('SessionCrypto: Session key loaded from storage');
        }

        setSessionKey(key);
        setIsReady(true);
      } catch (error) {
        console.error('SessionCrypto: Failed to initialize session:', error);
        setIsReady(false);
      }
    };

    initializeSession();
  }, [user]);

  // Шифрование контента перед отправкой в базу
  const encrypt = useCallback(async (content: string): Promise<string> => {
    if (!sessionKey) {
      throw new Error('Session key not initialized');
    }

    // Медиа-файлы не шифруем
    if (isMediaUrl(content)) {
      return content;
    }

    try {
      return await sessionCrypto.encryptWithSessionKey(content, sessionKey);
    } catch (error) {
      console.error('SessionCrypto: Encryption failed:', error);
      throw error;
    }
  }, [sessionKey]);

  // Расшифровка контента при получении из базы
  const decrypt = useCallback(async (encryptedContent: string): Promise<string> => {
    if (!sessionKey) {
      // Если ключ не готов, возвращаем как есть (может быть незашифрованное сообщение)
      return encryptedContent;
    }

    // Медиа-файлы не расшифровываем
    if (isMediaUrl(encryptedContent)) {
      return encryptedContent;
    }

    // Проверяем, зашифровано ли сообщение
    if (!sessionCrypto.isEncrypted(encryptedContent)) {
      // Не зашифровано, возвращаем как есть
      return encryptedContent;
    }

    try {
      return await sessionCrypto.decryptWithSessionKey(encryptedContent, sessionKey);
    } catch (error) {
      console.error('SessionCrypto: Decryption failed:', error);
      // При ошибке расшифровки возвращаем оригинал (лучше чем заглушка)
      return encryptedContent;
    }
  }, [sessionKey]);

  // Очистка сессии при выходе
  const clearSession = useCallback(() => {
    sessionCrypto.clearSessionKey();
    setSessionKey(null);
    setIsReady(false);
    console.log('SessionCrypto: Session cleared');
  }, []);

  const value: SessionCryptoContextType = {
    isReady,
    sessionKey,
    encrypt,
    decrypt,
    clearSession,
  };

  return (
    <SessionCryptoContext.Provider value={value}>
      {children}
    </SessionCryptoContext.Provider>
  );
}

/**
 * Проверка, является ли контент URL медиа-файла
 */
function isMediaUrl(content: string): boolean {
  if (!content.startsWith('http://') && !content.startsWith('https://')) {
    return false;
  }
  
  const trimmed = content.trim();
  if (trimmed.length > 500) {
    return false;
  }
  
  const mediaPatterns = [
    /\/storage\/v1\/object\//,
    /\.(mp4|webm|ogg|mp3|wav|m4a|jpg|jpeg|png|gif|webp)(\?|$)/i,
    /\/images\//,
    /\/video\//,
    /\/audio\//,
    /\/voice\//
  ];
  
  return mediaPatterns.some(pattern => pattern.test(trimmed));
}

