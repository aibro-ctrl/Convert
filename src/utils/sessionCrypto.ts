/**
 * Сессионное шифрование (как в Telegram)
 * 
 * Архитектура:
 * - Один симметричный ключ AES-GCM 256 на сессию
 * - Ключ генерируется при входе пользователя
 * - Хранится только в памяти (sessionStorage для персистентности между перезагрузками страницы)
 * - Удаляется при выходе
 * - Все сообщения шифруются только при отправке в базу
 * - В приложении сообщения не зашифрованы (в памяти)
 * - В базе - зашифрованы
 */

const ENCRYPTION_VERSION = 'v1';
const SESSION_KEY_STORAGE_KEY = 'session_encryption_key';
// Глобальное «зерно» для deteministic‑ключа.
// Важно: ключ не хранится в базе и не передается на сервер,
// но одинаков для всех клиентов, чтобы все участники чата могли читать сообщения.
const GLOBAL_KEY_SEED = 'convert-chat-global-session-key-v1';

export interface EncryptedData {
  version: string;
  ciphertext: string; // Base64 encoded
  iv: string; // Base64 encoded
}

/**
 * Генерация детерминированного «сессионного» ключа AES-GCM 256
 * вместо случайного – чтобы все клиенты могли расшифровывать сообщения друг друга.
 * Фактически это один общий ключ для всего приложения, который никогда не попадает в базу.
 */
export async function generateSessionKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const seedBytes = encoder.encode(GLOBAL_KEY_SEED);
  // Получаем стабильный 256‑битный материал ключа из seed
  const hash = await crypto.subtle.digest('SHA-256', seedBytes);

  return await crypto.subtle.importKey(
    'raw',
    hash,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Сохранение сессионного ключа в sessionStorage
 */
export async function saveSessionKey(key: CryptoKey): Promise<void> {
  try {
    const exported = await crypto.subtle.exportKey('raw', key);
    const keyB64 = arrayBufferToBase64(exported);
    sessionStorage.setItem(SESSION_KEY_STORAGE_KEY, keyB64);
  } catch (error) {
    console.error('Failed to save session key:', error);
    throw error;
  }
}

/**
 * Загрузка сессионного ключа из sessionStorage
 */
export async function loadSessionKey(): Promise<CryptoKey | null> {
  try {
    const keyB64 = sessionStorage.getItem(SESSION_KEY_STORAGE_KEY);
    if (!keyB64) {
      return null;
    }

    const keyBuffer = base64ToArrayBuffer(keyB64);
    return await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
  } catch (error) {
    console.error('Failed to load session key:', error);
    return null;
  }
}

/**
 * Удаление сессионного ключа
 */
export function clearSessionKey(): void {
  sessionStorage.removeItem(SESSION_KEY_STORAGE_KEY);
}

/**
 * Шифрование данных сессионным ключом
 */
export async function encryptWithSessionKey(
  plaintext: string,
  sessionKey: CryptoKey
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // Генерируем случайный IV для каждого сообщения
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Шифруем данные
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    sessionKey,
    data
  );

  // Формируем структуру зашифрованных данных
  const encryptedData: EncryptedData = {
    version: ENCRYPTION_VERSION,
    ciphertext: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv),
  };

  return JSON.stringify(encryptedData);
}

/**
 * Расшифровка данных сессионным ключом
 */
export async function decryptWithSessionKey(
  encryptedDataString: string,
  sessionKey: CryptoKey
): Promise<string> {
  try {
    // Парсим зашифрованные данные
    const encryptedData: EncryptedData = JSON.parse(encryptedDataString);
    
    if (encryptedData.version !== ENCRYPTION_VERSION) {
      throw new Error(`Unsupported encryption version: ${encryptedData.version}`);
    }

    // Конвертируем из Base64
    const ciphertext = base64ToArrayBuffer(encryptedData.ciphertext);
    const iv = base64ToArrayBuffer(encryptedData.iv);

    // Расшифровываем
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(iv),
      },
      sessionKey,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Проверка, является ли строка зашифрованными данными
 */
export function isEncrypted(data: string): boolean {
  try {
    const parsed = JSON.parse(data);
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      parsed.version === ENCRYPTION_VERSION &&
      typeof parsed.ciphertext === 'string' &&
      typeof parsed.iv === 'string'
    );
  } catch {
    return false;
  }
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

