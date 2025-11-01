/**
 * Сжатие изображения с сохранением пропорций
 */
export async function compressImage(
  file: File,
  maxWidth: number = 1920,
  maxHeight: number = 1080,
  quality: number = 0.8
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Создаем canvas
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Вычисляем новые размеры с сохранением пропорций
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Рисуем изображение
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Не удалось создать canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Конвертируем в blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Не удалось сжать изображение'));
              return;
            }
            
            // Создаем новый файл из blob
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            
            console.log(`Сжатие: ${(file.size / 1024).toFixed(2)} KB -> ${(compressedFile.size / 1024).toFixed(2)} KB`);
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      
      img.onerror = () => {
        reject(new Error('Не удалось загрузить изображение'));
      };
      
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => {
      reject(new Error('Не удалось прочитать файл'));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Сжатие видео (упрощенная версия - просто проверка размера)
 */
export async function compressVideo(
  file: File,
  maxSizeMB: number = 30
): Promise<File> {
  const maxSize = maxSizeMB * 1024 * 1024;
  
  if (file.size <= maxSize) {
    return file;
  }
  
  // Для реального сжатия видео нужна более сложная библиотека
  // Пока просто возвращаем ошибку если файл слишком большой
  throw new Error(`Видео слишком большое. Максимальный размер: ${maxSizeMB} МБ`);
}

/**
 * Сжатие аудио (упрощенная версия - просто проверка размера)
 */
export async function compressAudio(
  blob: Blob,
  maxSizeMB: number = 10
): Promise<Blob> {
  const maxSize = maxSizeMB * 1024 * 1024;
  
  if (blob.size <= maxSize) {
    return blob;
  }
  
  // Для реального сжатия аудио нужна более сложная библиотека
  throw new Error(`Аудио слишком большое. Максимальный размер: ${maxSizeMB} МБ`);
}
