/**
 * Утилита для прозрачного шифрования/расшифровки сообщений
 * 
 * Использование:
 * 1. При отправке сообщения: const encrypted = await encryptMessageContent(content, context, roomId, recipientId)
 * 2. При получении сообщения: const decrypted = await decryptMessageContent(encrypted, context, message)
 */

import { CryptoContextType } from '../contexts/CryptoContext';
import { Message } from './api';

/**
 * Шифрование контента сообщения перед отправкой
 * @param content - Текст сообщения
 * @param cryptoContext - Контекст шифрования
 * @param roomId - ID комнаты (для групповых чатов)
 * @param recipientId - ID получателя (для личных сообщений)
 * @returns Зашифрованный контент или исходный текст при ошибке
 */
export async function encryptMessageContent(
  content: string,
  cryptoContext: CryptoContextType | null,
  roomId?: string,
  recipientId?: string
): Promise<string> {
  // Если шифрование не готово, отправляем незашифрованное сообщение
  if (!cryptoContext || !cryptoContext.isReady) {
    console.warn('E2EE: Encryption not ready, sending unencrypted message');
    return content;
  }

  try {
    // Шифруем контент
    const encrypted = await cryptoContext.encryptMessage(content, recipientId, roomId);
    console.log('E2EE: Message encrypted successfully');
    return encrypted;
  } catch (error) {
    console.error('E2EE: Encryption failed, sending unencrypted:', error);
    // В случае ошибки шифрования, отправляем исходный текст
    return content;
  }
}

/**
 * Расшифровка контента сообщения при получении
 * @param encryptedContent - Зашифрованный текст
 * @param cryptoContext - Контекст шифрования
 * @param message - Объект сообщения с метаданными
 * @returns Расшифрованный контент или сообщение об ошибке
 */
export async function decryptMessageContent(
  encryptedContent: string,
  cryptoContext: CryptoContextType | null,
  message: Message
): Promise<string> {
  // Если шифрование не готово, показываем как есть
  if (!cryptoContext || !cryptoContext.isReady) {
    console.warn('E2EE: Decryption not ready');
    return encryptedContent;
  }

  // Проверяем, является ли контент зашифрованным (JSON объект)
  if (!isEncrypted(encryptedContent)) {
    // Это незашифрованное сообщение, возвращаем как есть
    return encryptedContent;
  }

  try {
    // Расшифровываем контент
    const decrypted = await cryptoContext.decryptMessage(
      encryptedContent,
      message.sender_id,
      message.room_id
    );
    return decrypted;
  } catch (error) {
    console.error('E2EE: Decryption failed:', error);
    return '[🔒 Зашифровано - не удалось расшифровать]';
  }
}

/**
 * Проверка, является ли контент зашифрованным
 */
function isEncrypted(content: string): boolean {
  try {
    const parsed = JSON.parse(content);
    // Проверяем структуру зашифрованного сообщения
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      'version' in parsed &&
      'ciphertext' in parsed &&
      'iv' in parsed
    );
  } catch {
    return false;
  }
}

/**
 * Пакетная расшифровка сообщений (для оптимизации)
 */
export async function decryptMessages(
  messages: Message[],
  cryptoContext: CryptoContextType | null
): Promise<Map<string, string>> {
  const decryptedMap = new Map<string, string>();

  if (!cryptoContext || !cryptoContext.isReady) {
    return decryptedMap;
  }

  // Расшифровываем все сообщения параллельно
  await Promise.all(
    messages.map(async (message) => {
      try {
        const decrypted = await decryptMessageContent(message.content, cryptoContext, message);
        decryptedMap.set(message.id, decrypted);
      } catch (error) {
        console.error(`E2EE: Failed to decrypt message ${message.id}:`, error);
        decryptedMap.set(message.id, '[🔒 Зашифровано]');
      }
    })
  );

  return decryptedMap;
}

/**
 * Инициализация ключей комнаты при создании/вступлении
 */
export async function initializeRoomEncryption(
  roomId: string,
  memberIds: string[],
  cryptoContext: CryptoContextType | null
): Promise<boolean> {
  if (!cryptoContext || !cryptoContext.isReady) {
    console.warn('E2EE: Cannot initialize room encryption - crypto not ready');
    return false;
  }

  try {
    await cryptoContext.createRoomKey(roomId, memberIds);
    console.log(`E2EE: Room ${roomId} encryption initialized for ${memberIds.length} members`);
    return true;
  } catch (error) {
    console.error('E2EE: Failed to initialize room encryption:', error);
    return false;
  }
}

/**
 * Добавление участника в зашифрованную комнату
 */
export async function addMemberToEncryptedRoom(
  roomId: string,
  userId: string,
  cryptoContext: CryptoContextType | null
): Promise<boolean> {
  if (!cryptoContext || !cryptoContext.isReady) {
    console.warn('E2EE: Cannot add member to encrypted room - crypto not ready');
    return false;
  }

  try {
    await cryptoContext.addMemberToRoom(roomId, userId);
    console.log(`E2EE: Member ${userId} added to encrypted room ${roomId}`);
    return true;
  } catch (error) {
    console.error('E2EE: Failed to add member to encrypted room:', error);
    return false;
  }
}
