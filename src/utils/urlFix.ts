// URL fixing utilities for media files
import { supabaseUrl } from './supabase/info';

/**
 * Fix media URLs to ensure they work correctly with Supabase storage
 * Handles both relative and absolute URLs
 */
export function fixMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  
  // Already a full URL, return as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Handle blob URLs (from local file uploads before upload)
  if (url.startsWith('blob:')) {
    return url;
  }
  
  // Handle data URLs
  if (url.startsWith('data:')) {
    return url;
  }
  
  // Remove leading slashes
  const cleanUrl = url.replace(/^\/+/, '');
  
  // If it's a storage path, construct full Supabase storage URL
  if (cleanUrl.startsWith('storage/v1/object/public/')) {
    return `${supabaseUrl}/${cleanUrl}`;
  }
  
  // If it's just a bucket path, add the storage prefix
  const buckets = ['avatars', 'chat-media', 'attachments', 'audio', 'video', 'images'];
  const startsWithBucket = buckets.some(bucket => cleanUrl.startsWith(bucket));
  
  if (startsWithBucket) {
    return `${supabaseUrl}/storage/v1/object/public/${cleanUrl}`;
  }
  
  // Default: assume it's relative to supabase URL
  return `${supabaseUrl}/${cleanUrl}`;
}

/**
 * Extract bucket and path from a Supabase storage URL
 */
export function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  try {
    const storageMatch = url.match(/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
    if (storageMatch) {
      return {
        bucket: storageMatch[1],
        path: storageMatch[2],
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get thumbnail URL for an image (if thumbnails are supported)
 */
export function getThumbnailUrl(url: string, width: number = 200, height: number = 200): string {
  const fixed = fixMediaUrl(url);
  
  // For Supabase storage, we can add transformation params (if supported)
  // This is a placeholder - implement based on your storage setup
  if (fixed.includes('/storage/v1/object/public/')) {
    return `${fixed}?width=${width}&height=${height}&resize=contain`;
  }
  
  return fixed;
}
