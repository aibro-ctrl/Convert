import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as crypto from '../utils/crypto';
import { useAuth } from './AuthContext';
import { usersAPI } from '../utils/api';

export interface CryptoContextType {
  isReady: boolean;
  publicKey: CryptoKey | null;
  privateKey: CryptoKey | null;
  initializeKeys: (password: string) => Promise<void>;
  encryptMessage: (content: string, recipientId?: string, roomId?: string) => Promise<string>;
  decryptMessage: (encryptedContent: string, senderId?: string, roomId?: string) => Promise<string>;
  encryptForRoom: (content: string, roomId: string) => Promise<string>;
  decryptFromRoom: (encryptedContent: string, roomId: string) => Promise<string>;
  getRoomKey: (roomId: string) => Promise<CryptoKey | null>;
  createRoomKey: (roomId: string, memberIds: string[]) => Promise<void>;
  addMemberToRoom: (roomId: string, userId: string) => Promise<void>;
  clearKeys: () => void;
}

const CryptoContext = createContext<CryptoContextType | null>(null);

export function useCrypto() {
  const context = useContext(CryptoContext);
  if (!context) {
    throw new Error('useCrypto must be used within CryptoProvider');
  }
  return context;
}

interface CryptoProviderProps {
  children: React.ReactNode;
}

export function CryptoProvider({ children }: CryptoProviderProps) {
  const { user } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [publicKey, setPublicKey] = useState<CryptoKey | null>(null);
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [roomKeysCache, setRoomKeysCache] = useState<Map<string, CryptoKey>>(new Map());

  // Автоматическая инициализация ключей при входе
  useEffect(() => {
    if (!user) {
      // Очистка при выходе
      setPublicKey(null);
      setPrivateKey(null);
      setRoomKeysCache(new Map());
      setIsReady(false);
      return;
    }

    // Проверяем временный пароль из AuthContext
    const tempPassword = localStorage.getItem('temp_password');
    if (tempPassword) {
      console.log('E2EE: Auto-initializing encryption keys...');
      initializeKeys(tempPassword).catch((error) => {
        console.error('E2EE: Auto-initialization failed:', error);
        // Не показываем ошибку пользователю при первой попытке
      });
    } else {
      // Проверяем, есть ли сохраненные ключи (повторный вход)
      const storedKeys = crypto.getKeysFromStorage();
      if (storedKeys.publicKey && storedKeys.privateKey) {
        console.log('E2EE: Encryption keys found in storage, waiting for password...');
        // Ключи есть, но нужен пароль для расшифровки
        setIsReady(false);
      }
    }
  }, [user]);

  // Инициализация ключей при входе
  const initializeKeys = useCallback(async (password: string) => {
    if (!user) return;

    try {
      const storedKeys = crypto.getKeysFromStorage();

      if (storedKeys.publicKey && storedKeys.privateKey) {
        // Импортируем существующие ключи
        console.log('E2EE: Importing existing keys...');
        const pubKey = await crypto.importPublicKey(storedKeys.publicKey);
        const privKey = await crypto.importPrivateKey(storedKeys.privateKey, password);
        
        setPublicKey(pubKey);
        setPrivateKey(privKey);
        setIsReady(true);
        console.log('E2EE: Keys imported successfully');
      } else {
        // Генерируем новые ключи
        console.log('E2EE: Generating new encryption keys...');
        const { publicKey: pubKey, privateKey: privKey } = await crypto.generateKeyPair();
        
        const publicKeyB64 = await crypto.exportPublicKey(pubKey);
        const privateKeyB64 = await crypto.exportPrivateKey(privKey, password);

        // Сохраняем локально
        crypto.saveKeysToStorage(publicKeyB64, privateKeyB64);

        // Отправляем публичный ключ на сервер
        try {
          await usersAPI.updatePublicKey(publicKeyB64);
          console.log('E2EE: Public key uploaded to server');
        } catch (error) {
          console.error('E2EE: Failed to upload public key:', error);
          // Продолжаем работу даже если загрузка не удалась
        }

        setPublicKey(pubKey);
        setPrivateKey(privKey);
        setIsReady(true);
        console.log('E2EE: Keys generated and saved successfully');
      }
    } catch (error) {
      console.error('Failed to initialize encryption keys:', error);
      throw new Error('Не удалось инициализировать ключи шифрования. Проверьте пароль.');
    }
  }, [user]);

  // Очистка ключей при выходе
  const clearKeys = useCallback(() => {
    setPublicKey(null);
    setPrivateKey(null);
    setRoomKeysCache(new Map());
    setIsReady(false);
    crypto.clearKeysFromStorage();
  }, []);

  // Получение публичного ключа пользователя
  const getUserPublicKey = useCallback(async (userId: string): Promise<CryptoKey> => {
    const userData = await usersAPI.getById(userId);
    if (!userData.user.public_key) {
      throw new Error('User does not have encryption key');
    }
    return await crypto.importPublicKey(userData.user.public_key);
  }, []);

  // Шифрование сообщения для конкретного получателя (личные сообщения)
  const encryptMessage = useCallback(async (
    content: string,
    recipientId?: string,
    roomId?: string
  ): Promise<string> => {
    if (!publicKey) {
      throw new Error('Encryption keys not initialized');
    }

    // Если это личное сообщение
    if (recipientId) {
      const recipientPublicKey = await getUserPublicKey(recipientId);
      const encrypted = await crypto.encryptWithPublicKey(content, recipientPublicKey);
      return JSON.stringify(encrypted);
    }

    // Если это групповое сообщение
    if (roomId) {
      return await encryptForRoom(content, roomId);
    }

    throw new Error('Either recipientId or roomId must be provided');
  }, [publicKey]);

  // Расшифровка сообщения
  const decryptMessage = useCallback(async (
    encryptedContent: string,
    senderId?: string,
    roomId?: string
  ): Promise<string> => {
    if (!privateKey) {
      throw new Error('Encryption keys not initialized');
    }

    try {
      const encrypted = JSON.parse(encryptedContent);

      // Если это личное сообщение
      if (senderId && !roomId) {
        return await crypto.decryptWithPrivateKey(encrypted, privateKey);
      }

      // Если это групповое сообщение
      if (roomId) {
        return await decryptFromRoom(encryptedContent, roomId);
      }

      // Пытаемся расшифровать как личное сообщение
      return await crypto.decryptWithPrivateKey(encrypted, privateKey);
    } catch (error) {
      console.error('Decryption failed:', error);
      return '[Не удалось расшифровать сообщение]';
    }
  }, [privateKey]);

  // Получение ключа комнаты
  const getRoomKey = useCallback(async (roomId: string): Promise<CryptoKey | null> => {
    // Проверяем кэш
    if (roomKeysCache.has(roomId)) {
      return roomKeysCache.get(roomId)!;
    }

    if (!privateKey) return null;

    // Получаем зашифрованный ключ комнаты из localStorage
    const encryptedRoomKeyB64 = crypto.getRoomKey(roomId);
    if (!encryptedRoomKeyB64) {
      return null;
    }

    try {
      const roomKey = await crypto.decryptRoomKeyForUser(encryptedRoomKeyB64, privateKey);
      
      // Сохраняем в кэш
      setRoomKeysCache(prev => new Map(prev).set(roomId, roomKey));
      
      return roomKey;
    } catch (error) {
      console.error('Failed to decrypt room key:', error);
      return null;
    }
  }, [privateKey, roomKeysCache]);

  // Шифрование для групповой комнаты
  const encryptForRoom = useCallback(async (content: string, roomId: string): Promise<string> => {
    let roomKey = await getRoomKey(roomId);

    if (!roomKey) {
      throw new Error('Room key not available. Contact room admin.');
    }

    const encrypted = await crypto.encryptWithRoomKey(content, roomKey);
    return JSON.stringify(encrypted);
  }, [getRoomKey]);

  // Расшифровка из групповой комнаты
  const decryptFromRoom = useCallback(async (encryptedContent: string, roomId: string): Promise<string> => {
    const roomKey = await getRoomKey(roomId);

    if (!roomKey) {
      return '[Ключ комнаты недоступен]';
    }

    try {
      const encrypted = JSON.parse(encryptedContent);
      return await crypto.decryptWithRoomKey(encrypted, roomKey);
    } catch (error) {
      console.error('Room decryption failed:', error);
      return '[Не удалось расшифровать сообщение комнаты]';
    }
  }, [getRoomKey]);

  // Создание ключа для новой комнаты
  const createRoomKey = useCallback(async (roomId: string, memberIds: string[]) => {
    if (!publicKey) {
      throw new Error('Encryption keys not initialized');
    }

    // Генерируем новый ключ комнаты
    const roomKey = await crypto.generateRoomKey();

    // Шифруем ключ комнаты для каждого участника
    const encryptedKeys: { [userId: string]: string } = {};

    for (const memberId of memberIds) {
      const memberPublicKey = await getUserPublicKey(memberId);
      const encryptedRoomKey = await crypto.encryptRoomKeyForUser(roomKey, memberPublicKey);
      encryptedKeys[memberId] = encryptedRoomKey;
    }

    // Сохраняем свой зашифрованный ключ локально
    if (user && encryptedKeys[user.id]) {
      crypto.saveRoomKey(roomId, encryptedKeys[user.id]);
      setRoomKeysCache(prev => new Map(prev).set(roomId, roomKey));
    }

    // Отправляем зашифрованные ключи на сервер для других участников
    await usersAPI.saveRoomKeys(roomId, encryptedKeys);
  }, [publicKey, user]);

  // Добавление нового участника в комнату
  const addMemberToRoom = useCallback(async (roomId: string, userId: string) => {
    const roomKey = await getRoomKey(roomId);
    
    if (!roomKey) {
      throw new Error('Room key not available');
    }

    // Получаем публичный ключ нового участника
    const userPublicKey = await getUserPublicKey(userId);

    // Шифруем ключ комнаты для нового участника
    const encryptedRoomKey = await crypto.encryptRoomKeyForUser(roomKey, userPublicKey);

    // Отправляем зашифрованный ключ на сервер
    await usersAPI.saveRoomKeys(roomId, { [userId]: encryptedRoomKey });
  }, [getRoomKey]);

  const value: CryptoContextType = {
    isReady,
    publicKey,
    privateKey,
    initializeKeys,
    encryptMessage,
    decryptMessage,
    encryptForRoom,
    decryptFromRoom,
    getRoomKey,
    createRoomKey,
    addMemberToRoom,
    clearKeys,
  };

  return <CryptoContext.Provider value={value}>{children}</CryptoContext.Provider>;
}