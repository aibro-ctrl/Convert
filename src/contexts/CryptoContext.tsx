import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as crypto from '../utils/crypto';
import { useAuth } from './AuthContext';
import { usersAPI } from '../utils/api';
import * as cryptoUtils from '../utils/crypto';
import { basicDecrypt } from '../utils/messageEncryption';

interface CryptoContextType {
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

  // Автоматическая инициализация ключей при входе (упрощенная версия как в Telegram)
  useEffect(() => {
    if (!user) {
      // Очистка при выходе
      setPublicKey(null);
      setPrivateKey(null);
      setRoomKeysCache(new Map());
      setIsReady(false);
      return;
    }

    // Автоматическая инициализация без пароля (как в Telegram)
    const autoInitialize = async () => {
      try {
        const storedKeys = crypto.getKeysFromStorage();
        
        if (storedKeys.publicKey && storedKeys.privateKey) {
          // Импортируем существующие ключи (используем автоматический пароль)
          console.log('E2EE: Importing existing keys...');
          const autoPassword = `${user.id}-${user.username}`; // Автоматический пароль на основе ID и username
          try {
            const pubKey = await crypto.importPublicKey(storedKeys.publicKey);
            const privKey = await crypto.importPrivateKey(storedKeys.privateKey, autoPassword);
            
            setPublicKey(pubKey);
            setPrivateKey(privKey);
            setIsReady(true);
            console.log('E2EE: Keys imported successfully');
            return;
          } catch (importError) {
            console.warn('E2EE: Failed to import existing keys, generating new ones:', importError);
            // Если не удалось импортировать, генерируем новые
          }
        }
        
        // Генерируем новые ключи автоматически
        console.log('E2EE: Generating new encryption keys automatically...');
        const { publicKey: pubKey, privateKey: privKey } = await crypto.generateKeyPair();
        
        const autoPassword = `${user.id}-${user.username}`; // Автоматический пароль
        const publicKeyB64 = await crypto.exportPublicKey(pubKey);
        const privateKeyB64 = await crypto.exportPrivateKey(privKey, autoPassword);

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
      } catch (error) {
        console.error('E2EE: Auto-initialization failed:', error);
        // Даже при ошибке устанавливаем isReady в true, чтобы не блокировать отправку
        setIsReady(true);
      }
    };

    autoInitialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Получение ключа комнаты
  const getRoomKey = useCallback(async (roomId: string): Promise<CryptoKey | null> => {
    // Проверяем кэш
    if (roomKeysCache.has(roomId)) {
      const cachedKey = roomKeysCache.get(roomId)!;
      console.log('E2EE: Room key found in cache');
      return cachedKey;
    }

    if (!privateKey) {
      console.warn('E2EE: Private key not available for room key decryption');
      return null;
    }

    // Получаем зашифрованный ключ комнаты из localStorage
    const encryptedRoomKeyB64 = crypto.getRoomKey(roomId);
    if (!encryptedRoomKeyB64) {
      console.log('E2EE: Room key not found in localStorage');
      return null;
    }

    try {
      console.log('E2EE: Decrypting room key from localStorage...');
      const roomKey = await crypto.decryptRoomKeyForUser(encryptedRoomKeyB64, privateKey);
      
      // Сохраняем в кэш
      setRoomKeysCache(prev => new Map(prev).set(roomId, roomKey));
      console.log('E2EE: Room key decrypted and cached successfully');
      
      return roomKey;
    } catch (error: any) {
      console.error('E2EE: Failed to decrypt room key from localStorage:', error);
      // Если расшифровка не удалась, возможно ключ зашифрован другим ключом
      // Удаляем невалидный ключ из localStorage
      const roomKeys = JSON.parse(localStorage.getItem('room_keys') || '{}');
      delete roomKeys[roomId];
      localStorage.setItem('room_keys', JSON.stringify(roomKeys));
      console.log('E2EE: Removed invalid room key from localStorage');
      return null;
    }
  }, [privateKey, roomKeysCache]);

  // Создание ключа для новой комнаты (объявлено ДО encryptForRoom, чтобы избежать ошибки инициализации)
  const createRoomKey = useCallback(async (roomId: string, memberIds: string[]) => {
    if (!publicKey || !privateKey) {
      throw new Error('Encryption keys not initialized');
    }

    if (!user) {
      throw new Error('Current user not found');
    }

    // Генерируем новый ключ комнаты
    const roomKey = await crypto.generateRoomKey();
    console.log('E2EE: Generated new room key');

    // ВАЖНО: Сначала шифруем ключ для текущего пользователя, чтобы гарантировать его доступность
    const encryptedKeys: { [userId: string]: string } = {};
    const membersWithKeys: string[] = [];

    // Шифруем ключ для текущего пользователя в первую очередь
    try {
      const encryptedRoomKeyForMe = await crypto.encryptRoomKeyForUser(roomKey, publicKey);
      encryptedKeys[user.id] = encryptedRoomKeyForMe;
      membersWithKeys.push(user.id);
      console.log(`E2EE: Room key encrypted for current user ${user.id}`);
      
      // Сохраняем свой зашифрованный ключ локально СРАЗУ
      crypto.saveRoomKey(roomId, encryptedRoomKeyForMe);
      setRoomKeysCache(prev => new Map(prev).set(roomId, roomKey));
      console.log('E2EE: Room key saved locally for current user');
    } catch (error) {
      console.error('E2EE: Failed to encrypt room key for current user:', error);
      throw new Error('Failed to encrypt room key for current user');
    }

    // Теперь шифруем ключ для остальных участников
    for (const memberId of memberIds) {
      // Пропускаем текущего пользователя (уже обработан)
      if (memberId === user.id) {
        continue;
      }

      try {
        const memberPublicKey = await getUserPublicKey(memberId);
        const encryptedRoomKey = await crypto.encryptRoomKeyForUser(roomKey, memberPublicKey);
        encryptedKeys[memberId] = encryptedRoomKey;
        membersWithKeys.push(memberId);
        console.log(`E2EE: Room key encrypted for member ${memberId}`);
      } catch (error: any) {
        // Если участник не имеет ключа шифрования, пропускаем его
        if (error.message && error.message.includes('does not have encryption key')) {
          console.warn(`E2EE: Member ${memberId} does not have encryption key, skipping`);
          continue;
        }
        // Для других ошибок пробрасываем дальше
        throw error;
      }
    }

    // Отправляем зашифрованные ключи на сервер только для участников с ключами
    if (Object.keys(encryptedKeys).length > 0) {
      try {
        await usersAPI.saveRoomKeys(roomId, encryptedKeys);
        console.log(`E2EE: Room key created and saved for ${membersWithKeys.length} out of ${memberIds.length} members`);
      } catch (error) {
        console.error('E2EE: Failed to save room keys to server:', error);
        // Не выбрасываем ошибку - ключ уже сохранен локально
        console.warn('E2EE: Room key saved locally but not on server');
      }
    } else {
      throw new Error('No members with encryption keys found');
    }
  }, [publicKey, privateKey, user, getUserPublicKey]);

  // Расшифровка из групповой комнаты (объявлено ДО decryptMessage, так как используется в нем)
  const decryptFromRoom = useCallback(async (encryptedContent: string, roomId: string): Promise<string> => {
    const roomKey = await getRoomKey(roomId);

    if (!roomKey) {
      // Пытаемся получить ключ с сервера
      try {
        const roomKeyResponse = await usersAPI.getRoomKey(roomId);
        const roomKeyData = (roomKeyResponse as any).data || roomKeyResponse;
        if (roomKeyData && roomKeyData.encryptedKey && privateKey) {
          try {
            const importedKey = await crypto.decryptRoomKeyForUser(roomKeyData.encryptedKey, privateKey);
            setRoomKeysCache(prev => new Map(prev).set(roomId, importedKey));
            crypto.saveRoomKey(roomId, roomKeyData.encryptedKey);
            const encrypted = JSON.parse(encryptedContent);
            return await crypto.decryptWithRoomKey(encrypted, importedKey);
          } catch (decryptError) {
            console.error('E2EE: Failed to decrypt room key from server:', decryptError);
          }
        }
      } catch (error) {
        console.error('E2EE: Failed to get room key from server:', error);
      }
      
      // Если ключ все еще недоступен, проверяем, не базовое ли это шифрование
      try {
        const parsed = JSON.parse(encryptedContent);
        if (parsed.basic) {
          // Это базовое шифрование, пытаемся расшифровать
          return await basicDecrypt(encryptedContent);
        }
      } catch {
        // Не базовое шифрование
      }
      
      return '[Ключ комнаты недоступен]';
    }

    try {
      const encrypted = JSON.parse(encryptedContent);
      return await crypto.decryptWithRoomKey(encrypted, roomKey);
    } catch (error) {
      console.error('Room decryption failed:', error);
      // Пытаемся использовать базовое расшифрование
      try {
        const parsed = JSON.parse(encryptedContent);
        if (parsed.basic) {
          return await basicDecrypt(encryptedContent);
        }
      } catch {
        // Не базовое шифрование
      }
      return '[Не удалось расшифровать сообщение комнаты]';
    }
  }, [getRoomKey, privateKey]);

  // Расшифровка сообщения (объявлено ПОСЛЕ decryptFromRoom, так как использует его)
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
  }, [privateKey, decryptFromRoom]);

  // Шифрование для групповой комнаты
  const encryptForRoom = useCallback(async (content: string, roomId: string): Promise<string> => {
    let roomKey = await getRoomKey(roomId);

    if (!roomKey) {
      // Пытаемся получить ключ с сервера (для существующих чатов)
      try {
        const roomKeyResponse = await usersAPI.getRoomKey(roomId);
        // API возвращает { data: { encryptedKey } } или { encryptedKey }
        const roomKeyData = (roomKeyResponse as any).data || roomKeyResponse;
        if (roomKeyData && roomKeyData.encryptedKey) {
          // Импортируем и расшифровываем ключ комнаты
          const encryptedKeyB64 = roomKeyData.encryptedKey;
          if (privateKey) {
            try {
              const importedKey = await crypto.decryptRoomKeyForUser(encryptedKeyB64, privateKey);
              // Сохраняем в кэш и локально
              setRoomKeysCache(prev => new Map(prev).set(roomId, importedKey));
              crypto.saveRoomKey(roomId, encryptedKeyB64);
              roomKey = importedKey;
              console.log('E2EE: Room key successfully decrypted from server');
            } catch (decryptError: any) {
              console.error('E2EE: Failed to decrypt room key from server:', decryptError);
              // Если не удалось расшифровать, создаем новый ключ для текущего пользователя
              console.log('E2EE: Creating new room key for current user...');
              try {
                if (user) {
                  await createRoomKey(roomId, [user.id]);
                  roomKey = await getRoomKey(roomId);
                  if (roomKey) {
                    console.log('E2EE: New room key created successfully');
                  }
                }
              } catch (createError) {
                console.error('E2EE: Failed to create new room key:', createError);
                // Выбрасываем ошибку, чтобы использовать базовое шифрование
                throw new Error('Room key creation failed');
              }
            }
          }
        }
      } catch (error: any) {
        console.error('E2EE: Failed to get room key from server:', error);
        // Если ключа нет на сервере, создаем новый для текущего пользователя
        if (user && publicKey) {
          try {
            console.log('E2EE: Creating room key for current user as fallback...');
            await createRoomKey(roomId, [user.id]);
            roomKey = await getRoomKey(roomId);
            if (roomKey) {
              console.log('E2EE: Room key created successfully');
            }
          } catch (createError) {
            console.error('E2EE: Failed to create room key:', createError);
            // Выбрасываем ошибку, чтобы использовать базовое шифрование
            throw new Error('Room key creation failed');
          }
        } else {
          // Если нет пользователя или ключей, выбрасываем ошибку для базового шифрования
          throw new Error('Room key not available');
        }
      }
      
      if (!roomKey) {
        // Если все попытки не удались, выбрасываем ошибку для использования базового шифрования
        throw new Error('Room key not available');
      }
    }

    const encrypted = await crypto.encryptWithRoomKey(content, roomKey);
    return JSON.stringify(encrypted);
  }, [getRoomKey, privateKey, publicKey, user, createRoomKey]);

  // Шифрование сообщения для конкретного получателя (личные сообщения)
  // Объявлено ПОСЛЕ encryptForRoom, так как использует его
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
  }, [publicKey, getUserPublicKey, encryptForRoom]);

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