import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const BUCKET_NAME = 'make-b0f1e6d5-uploads';

// Инициализация bucket при запуске сервера
export async function initializeStorage() {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === BUCKET_NAME);
    
    if (!bucketExists) {
      console.log(`Creating storage bucket: ${BUCKET_NAME}`);
      const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: false,
        fileSizeLimit: 52428800, // 50 MB
        allowedMimeTypes: ['image/*', 'video/*', 'audio/*']
      });
      
      if (error) {
        // Ignore "already exists" error (race condition)
        // @ts-ignore
        if (error.statusCode === '409' || error.message?.includes('already exists')) {
          console.log(`Bucket ${BUCKET_NAME} already exists (race condition handled)`);
        } else {
          console.error('Error creating bucket:', error);
        }
      } else {
        console.log(`Bucket ${BUCKET_NAME} created successfully`);
      }
    } else {
      console.log(`Bucket ${BUCKET_NAME} already exists`);
    }
  } catch (error) {
    console.error('Error initializing storage:', error);
  }
}

// Загрузка файла
export async function uploadFile(
  fileData: Uint8Array,
  fileName: string,
  contentType: string,
  userId: string
): Promise<{ data?: { url: string; path: string }; error?: string }> {
  try {
    // Создаем уникальное имя файла
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const ext = fileName.split('.').pop();
    const path = `${userId}/${timestamp}-${randomStr}.${ext}`;

    // Загружаем файл
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, fileData, {
        contentType,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return { error: `Ошибка загрузки: ${uploadError.message}` };
    }

    // Получаем подписанный URL (действителен 1 год)
    const { data: signedUrlData, error: signedError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, 31536000); // 1 год в секундах

    if (signedError) {
      console.error('Signed URL error:', signedError);
      return { error: `Ошибка создания URL: ${signedError.message}` };
    }

    console.log('Storage - File uploaded successfully:', {
      path,
      signedUrl: signedUrlData.signedUrl.substring(0, 100) + '...'
    });

    return {
      data: {
        url: signedUrlData.signedUrl,
        path: path
      }
    };
  } catch (error: any) {
    console.error('Upload file exception:', error);
    return { error: `Ошибка: ${error.message}` };
  }
}

// Удаление файла
export async function deleteFile(path: string): Promise<{ error?: string }> {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);

    if (error) {
      console.error('Delete error:', error);
      return { error: `Ошибка удаления: ${error.message}` };
    }

    return {};
  } catch (error: any) {
    console.error('Delete file exception:', error);
    return { error: `Ошибка: ${error.message}` };
  }
}

// Получение подписанного URL для существующего файла
export async function getSignedUrl(path: string, expiresIn: number = 3600): Promise<{ data?: string; error?: string }> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, expiresIn);

    if (error) {
      console.error('Get signed URL error:', error);
      return { error: `Ошибка получения URL: ${error.message}` };
    }

    return { data: data.signedUrl };
  } catch (error: any) {
    console.error('Get signed URL exception:', error);
    return { error: `Ошибка: ${error.message}` };
  }
}
