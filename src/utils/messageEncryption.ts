/**
 * Утилита для прозрачного шифрования/расшифровки сообщений (сессионное шифрование как в Telegram)
 * 
 * Архитектура:
 * - Один симметричный ключ AES-GCM 256 на сессию
 * - Ключ генерируется при входе, удаляется при выходе
 * - Все сообщения шифруются только при отправке в базу
 * - В приложении сообщения не зашифрованы (в памяти)
 * - В базе - зашифрованы
 * 
 * Использование:
 * 1. При отправке сообщения: const encrypted = await encryptMessageContent(content, sessionCrypto)
 * 2. При получении сообщения: const decrypted = await decryptMessageContent(encrypted, sessionCrypto)
 */

import { SessionCryptoContextType } from '../contexts/SessionCryptoContext';
import { Message } from './api';
import * as sessionCrypto from './sessionCrypto';

/**
 * Проверяет, является ли контент URL медиа-файла
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

/**
 * Шифрование контента сообщения перед отправкой в базу
 * @param content - Текст сообщения
 * @param sessionCryptoContext - Контекст сессионного шифрования
 * @returns Зашифрованный контент для сохранения в базу
 */
export async function encryptMessageContent(
  content: string,
  sessionCryptoContext: SessionCryptoContextType | null
): Promise<string> {
  // НЕ шифруем URL медиа-файлов - они должны оставаться доступными для воспроизведения
  if (isMediaUrl(content)) {
    return content;
  }
  
  // Если сессионное шифрование не готово, возвращаем как есть (не шифруем)
  // Это нормально - сообщение будет незашифрованным в базе, но пользователь сможет его видеть
  if (!sessionCryptoContext || !sessionCryptoContext.isReady) {
    console.warn('SessionCrypto: Encryption not ready, sending unencrypted');
    return content;
  }

  try {
    // Шифруем контент сессионным ключом
    const encrypted = await sessionCryptoContext.encrypt(content);
    return encrypted;
  } catch (error: any) {
    console.error('SessionCrypto: Encryption failed:', error);
    // При ошибке возвращаем незашифрованный контент (лучше чем блокировка отправки)
    return content;
  }
}

/**
 * Расшифровка контента сообщения при получении из базы
 * @param encryptedContent - Зашифрованный текст из базы
 * @param sessionCryptoContext - Контекст сессионного шифрования
 * @param message - Объект сообщения с метаданными (не используется, но оставлен для совместимости)
 * @returns Расшифрованный контент для отображения в приложении
 */
export async function decryptMessageContent(
  encryptedContent: string,
  sessionCryptoContext: SessionCryptoContextType | null,
  message?: Message
): Promise<string> {
  // Если это URL медиа-файла, возвращаем как есть (не расшифровываем)
  if (isMediaUrl(encryptedContent)) {
    return encryptedContent;
  }
  
  // Если сессионное шифрование не готово, возвращаем как есть (может быть незашифрованное сообщение)
  if (!sessionCryptoContext || !sessionCryptoContext.isReady) {
    return encryptedContent;
  }

  try {
    // Расшифровываем контент сессионным ключом
    const decrypted = await sessionCryptoContext.decrypt(encryptedContent);
    return decrypted;
  } catch (error) {
    console.error('SessionCrypto: Decryption failed:', error);
    // Если это похоже на зашифрованный JSON, не показываем «сырой» объект в UI
    try {
      const parsed = JSON.parse(encryptedContent);
      if (parsed && typeof parsed === 'object' && 'ciphertext' in parsed) {
        return '[сообщение]';
      }
    } catch {
      // не JSON — просто вернём как есть
    }
    return encryptedContent;
  }
}

/**
 * Пакетная расшифровка сообщений (для оптимизации)
 */
export async function decryptMessages(
  messages: Message[],
  sessionCryptoContext: SessionCryptoContextType | null
): Promise<Map<string, string>> {
  const decryptedMap = new Map<string, string>();

  if (!sessionCryptoContext || !sessionCryptoContext.isReady) {
    // Если шифрование не готово, возвращаем оригинальный контент
    messages.forEach(message => {
      decryptedMap.set(message.id, message.content);
    });
    return decryptedMap;
  }

  // Расшифровываем все сообщения параллельно
  await Promise.all(
    messages.map(async (message) => {
      try {
        const decrypted = await decryptMessageContent(message.content, sessionCryptoContext, message);
        decryptedMap.set(message.id, decrypted);
      } catch (error) {
        console.error(`SessionCrypto: Failed to decrypt message ${message.id}:`, error);
        decryptedMap.set(message.id, message.content);
      }
    })
  );

  return decryptedMap;
}
