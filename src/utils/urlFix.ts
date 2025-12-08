// Утилита для исправления URL файлов и видео
// Заменяет неправильные хосты (например, kong:8000) на правильный адрес сервера

import { supabaseUrl } from './supabase/info';

/**
 * Исправляет URL, заменяя неправильные хосты на правильный адрес сервера
 * @param url - URL для исправления
 * @returns Исправленный URL
 */
export function fixFileUrl(url: string | null | undefined): string {
  if (!url) return '';
  
  try {
    // Сначала пытаемся простую замену для случаев, когда URL содержит kong:8000 или kong
    if (url.includes('kong:8000') || url.includes('kong/') || url.includes('kong')) {
      // Заменяем все варианты kong:8000 на правильный адрес
      let fixed = url
        .replace(/https?:\/\/kong:8000/g, supabaseUrl)
        .replace(/https?:\/\/kong\//g, `${supabaseUrl}/`)
        .replace(/https?:\/\/kong/g, supabaseUrl)
        .replace(/kong:8000/g, supabaseUrl.replace(/^https?:\/\//, ''))
        .replace(/\/\/kong\//g, `//${supabaseUrl.replace(/^https?:\/\//, '')}/`)
        .replace(/\/\/kong/g, `//${supabaseUrl.replace(/^https?:\/\//, '')}`);
      
      // Если после замены все еще есть kong, пытаемся более агрессивную замену
      if (fixed.includes('kong')) {
        // Извлекаем путь и параметры из URL
        const match = fixed.match(/(https?:\/\/)?kong(:8000)?(\/.*)/);
        if (match) {
          const path = match[3] || '';
          fixed = `${supabaseUrl}${path}`;
        }
      }
      
      console.log('Fixed URL (kong replacement):', url, '->', fixed);
      return fixed;
    }
    
    // Пытаемся парсить как URL
    const urlObj = new URL(url);
    
    // Если хост содержит "kong" или другие неправильные значения, заменяем на правильный
    if (urlObj.hostname === 'kong' || urlObj.hostname.includes('kong')) {
      // Сохраняем путь и параметры
      const pathWithQuery = urlObj.pathname + urlObj.search + urlObj.hash;
      const correctUrl = new URL(pathWithQuery, supabaseUrl);
      console.log('Fixed URL (URL object):', url, '->', correctUrl.toString());
      return correctUrl.toString();
    }
    
    // Если URL уже правильный, возвращаем как есть
    return url;
  } catch (error) {
    // Если URL невалидный, пытаемся исправить простой заменой
    if (url.includes('kong')) {
      let fixed = url
        .replace(/https?:\/\/kong:8000/g, supabaseUrl)
        .replace(/https?:\/\/kong\//g, `${supabaseUrl}/`)
        .replace(/https?:\/\/kong/g, supabaseUrl)
        .replace(/kong:8000/g, supabaseUrl.replace(/^https?:\/\//, ''))
        .replace(/\/\/kong\//g, `//${supabaseUrl.replace(/^https?:\/\//, '')}/`)
        .replace(/\/\/kong/g, `//${supabaseUrl.replace(/^https?:\/\//, '')}`);
      
      // Если после замены все еще есть kong, пытаемся извлечь путь
      if (fixed.includes('kong')) {
        const match = fixed.match(/(https?:\/\/)?kong(:8000)?(\/.*)/);
        if (match) {
          const path = match[3] || '';
          fixed = `${supabaseUrl}${path}`;
        }
      }
      
      console.log('Fixed URL (error fallback):', url, '->', fixed);
      return fixed;
    }
    
    // Если не удалось исправить, возвращаем оригинал
    console.warn('Could not fix URL:', url, error);
    return url;
  }
}

/**
 * Исправляет URL для изображений, видео и аудио файлов
 * @param url - URL для исправления
 * @returns Исправленный URL
 */
export function fixMediaUrl(url: string | null | undefined): string {
  return fixFileUrl(url);
}

