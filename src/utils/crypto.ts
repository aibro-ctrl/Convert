/**
 * End-to-End Encryption Utility
 * 
 * Архитектура:
 * - RSA-OAEP 2048 для асимметричного шифрования (личные сообщения)
 * - AES-GCM 256 для симметричного шифрования (групповые чаты)
 * - PBKDF2 для защиты приватного ключа паролем пользователя
 */

const ENCRYPTION_VERSION = 'v1';

// Типы для работы с ключами
export interface KeyPair {
  publicKey: string; // Base64 encoded
  privateKey: string; // Base64 encoded, encrypted with password
  publicKeyRaw?: CryptoKey; // For runtime use
  privateKeyRaw?: CryptoKey; // For runtime use
}

export interface EncryptedMessage {
  version: string;
  ciphertext: string; // Base64 encoded
  iv: string; // Base64 encoded
  encryptedKey?: string; // For AES, encrypted with RSA
}

/**
 * Генерация пары ключей RSA для пользователя
 */
export async function generateKeyPair(): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey }> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );

  return keyPair;
}

/**
 * Экспорт публичного ключа в Base64 строку
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('spki', publicKey);
  return arrayBufferToBase64(exported);
}

/**
 * Импорт публичного ключа из Base64 строки
 */
export async function importPublicKey(publicKeyB64: string): Promise<CryptoKey> {
  const publicKeyBuffer = base64ToArrayBuffer(publicKeyB64);
  return await crypto.subtle.importKey(
    'spki',
    publicKeyBuffer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['encrypt']
  );
}

/**
 * Экспорт приватного ключа, зашифрованного паролем пользователя
 */
export async function exportPrivateKey(privateKey: CryptoKey, password: string): Promise<string> {
  // Экспортируем приватный ключ
  const exported = await crypto.subtle.exportKey('pkcs8', privateKey);
  
  // Генерируем соль для PBKDF2
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // Создаем ключ шифрования из пароля
  const passwordKey = await deriveKeyFromPassword(password, salt);
  
  // Шифруем приватный ключ
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedPrivateKey = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    passwordKey,
    exported
  );

  // Комбинируем соль, IV и зашифрованный ключ
  const combined = new Uint8Array(salt.length + iv.length + encryptedPrivateKey.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encryptedPrivateKey), salt.length + iv.length);

  return arrayBufferToBase64(combined);
}

/**
 * Импорт приватного ключа, расшифрованного паролем пользователя
 */
export async function importPrivateKey(encryptedPrivateKeyB64: string, password: string): Promise<CryptoKey> {
  const combined = base64ToArrayBuffer(encryptedPrivateKeyB64);
  
  // Извлекаем соль, IV и зашифрованный ключ
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const encryptedPrivateKey = combined.slice(28);

  // Создаем ключ расшифрования из пароля
  const passwordKey = await deriveKeyFromPassword(password, new Uint8Array(salt));

  // Расшифровываем приватный ключ
  const decryptedPrivateKey = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(iv),
    },
    passwordKey,
    encryptedPrivateKey
  );

  // Импортируем приватный ключ
  return await crypto.subtle.importKey(
    'pkcs8',
    decryptedPrivateKey,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['decrypt']
  );
}

/**
 * Генерация симметричного ключа AES для групповых чатов
 */
export async function generateRoomKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Экспорт симметричного ключа комнаты
 */
export async function exportRoomKey(roomKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', roomKey);
  return arrayBufferToBase64(exported);
}

/**
 * Импорт симметричного ключа комнаты
 */
export async function importRoomKey(roomKeyB64: string): Promise<CryptoKey> {
  const roomKeyBuffer = base64ToArrayBuffer(roomKeyB64);
  return await crypto.subtle.importKey(
    'raw',
    roomKeyBuffer,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Шифрование текста с использованием публичного ключа RSA (для личных сообщений)
 */
export async function encryptWithPublicKey(plaintext: string, publicKey: CryptoKey): Promise<EncryptedMessage> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // RSA-OAEP может шифровать ограниченное количество данных
  // Для длинных сообщений используем гибридное шифрование
  if (data.length > 190) { // RSA-OAEP 2048 limit ~190 bytes
    return await hybridEncrypt(plaintext, publicKey);
  }

  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP',
    },
    publicKey,
    data
  );

  return {
    version: ENCRYPTION_VERSION,
    ciphertext: arrayBufferToBase64(encrypted),
    iv: '', // Not used for RSA
  };
}

/**
 * Расшифровка текста с использованием приватного ключа RSA
 */
export async function decryptWithPrivateKey(encrypted: EncryptedMessage, privateKey: CryptoKey): Promise<string> {
  // Проверяем версию шифрования
  if (encrypted.version !== ENCRYPTION_VERSION) {
    throw new Error('Unsupported encryption version');
  }

  // Если есть encryptedKey, это гибридное шифрование
  if (encrypted.encryptedKey) {
    return await hybridDecrypt(encrypted, privateKey);
  }

  const ciphertext = base64ToArrayBuffer(encrypted.ciphertext);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'RSA-OAEP',
    },
    privateKey,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Гибридное шифрование: AES для данных + RSA для ключа AES
 */
async function hybridEncrypt(plaintext: string, publicKey: CryptoKey): Promise<EncryptedMessage> {
  // Генерируем временный AES ключ
  const aesKey = await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );

  // Шифруем данные с AES
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encryptedData = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    aesKey,
    data
  );

  // Экспортируем AES ключ
  const exportedAesKey = await crypto.subtle.exportKey('raw', aesKey);

  // Шифруем AES ключ с RSA
  const encryptedAesKey = await crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP',
    },
    publicKey,
    exportedAesKey
  );

  return {
    version: ENCRYPTION_VERSION,
    ciphertext: arrayBufferToBase64(encryptedData),
    iv: arrayBufferToBase64(iv),
    encryptedKey: arrayBufferToBase64(encryptedAesKey),
  };
}

/**
 * Гибридная расшифровка
 */
async function hybridDecrypt(encrypted: EncryptedMessage, privateKey: CryptoKey): Promise<string> {
  if (!encrypted.encryptedKey) {
    throw new Error('Missing encrypted key for hybrid decryption');
  }

  // Расшифровываем AES ключ с RSA
  const encryptedAesKey = base64ToArrayBuffer(encrypted.encryptedKey);
  const decryptedAesKey = await crypto.subtle.decrypt(
    {
      name: 'RSA-OAEP',
    },
    privateKey,
    encryptedAesKey
  );

  // Импортируем AES ключ
  const aesKey = await crypto.subtle.importKey(
    'raw',
    decryptedAesKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['decrypt']
  );

  // Расшифровываем данные
  const ciphertext = base64ToArrayBuffer(encrypted.ciphertext);
  const iv = base64ToArrayBuffer(encrypted.iv);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(iv),
    },
    aesKey,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Шифрование с использованием симметричного ключа комнаты (для групповых чатов)
 */
export async function encryptWithRoomKey(plaintext: string, roomKey: CryptoKey): Promise<EncryptedMessage> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    roomKey,
    data
  );

  return {
    version: ENCRYPTION_VERSION,
    ciphertext: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv),
  };
}

/**
 * Расшифровка с использованием симметричного ключа комнаты
 */
export async function decryptWithRoomKey(encrypted: EncryptedMessage, roomKey: CryptoKey): Promise<string> {
  if (encrypted.version !== ENCRYPTION_VERSION) {
    throw new Error('Unsupported encryption version');
  }

  const ciphertext = base64ToArrayBuffer(encrypted.ciphertext);
  const iv = base64ToArrayBuffer(encrypted.iv);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(iv),
    },
    roomKey,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Шифрование ключа комнаты публичным ключом пользователя
 */
export async function encryptRoomKeyForUser(roomKey: CryptoKey, publicKey: CryptoKey): Promise<string> {
  const exportedRoomKey = await crypto.subtle.exportKey('raw', roomKey);
  
  const encryptedRoomKey = await crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP',
    },
    publicKey,
    exportedRoomKey
  );

  return arrayBufferToBase64(encryptedRoomKey);
}

/**
 * Расшифровка ключа комнаты приватным ключом пользователя
 */
export async function decryptRoomKeyForUser(encryptedRoomKeyB64: string, privateKey: CryptoKey): Promise<CryptoKey> {
  const encryptedRoomKey = base64ToArrayBuffer(encryptedRoomKeyB64);

  const decryptedRoomKey = await crypto.subtle.decrypt(
    {
      name: 'RSA-OAEP',
    },
    privateKey,
    encryptedRoomKey
  );

  return await crypto.subtle.importKey(
    'raw',
    decryptedRoomKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Создание ключа из пароля с использованием PBKDF2
 */
async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const importedPassword = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    importedPassword,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Утилиты для конвертации ArrayBuffer <-> Base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Проверка поддержки Web Crypto API
 */
export function isCryptoSupported(): boolean {
  return typeof crypto !== 'undefined' && 
         typeof crypto.subtle !== 'undefined' &&
         typeof crypto.subtle.generateKey === 'function';
}

/**
 * Хранение ключей в localStorage
 */
const STORAGE_KEYS = {
  PUBLIC_KEY: 'e2ee_public_key',
  PRIVATE_KEY: 'e2ee_private_key',
  ROOM_KEYS: 'e2ee_room_keys',
};

export function saveKeysToStorage(publicKey: string, privateKey: string): void {
  localStorage.setItem(STORAGE_KEYS.PUBLIC_KEY, publicKey);
  localStorage.setItem(STORAGE_KEYS.PRIVATE_KEY, privateKey);
}

export function getKeysFromStorage(): { publicKey: string | null; privateKey: string | null } {
  return {
    publicKey: localStorage.getItem(STORAGE_KEYS.PUBLIC_KEY),
    privateKey: localStorage.getItem(STORAGE_KEYS.PRIVATE_KEY),
  };
}

export function clearKeysFromStorage(): void {
  localStorage.removeItem(STORAGE_KEYS.PUBLIC_KEY);
  localStorage.removeItem(STORAGE_KEYS.PRIVATE_KEY);
  localStorage.removeItem(STORAGE_KEYS.ROOM_KEYS);
}

/**
 * Хранение ключей комнат
 */
export function saveRoomKey(roomId: string, encryptedRoomKey: string): void {
  const roomKeys = JSON.parse(localStorage.getItem(STORAGE_KEYS.ROOM_KEYS) || '{}');
  roomKeys[roomId] = encryptedRoomKey;
  localStorage.setItem(STORAGE_KEYS.ROOM_KEYS, JSON.stringify(roomKeys));
}

export function getRoomKey(roomId: string): string | null {
  const roomKeys = JSON.parse(localStorage.getItem(STORAGE_KEYS.ROOM_KEYS) || '{}');
  return roomKeys[roomId] || null;
}

export function clearRoomKeys(): void {
  localStorage.removeItem(STORAGE_KEYS.ROOM_KEYS);
}
