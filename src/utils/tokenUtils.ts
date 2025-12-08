// Utility functions for JWT token management

/**
 * Check if a JWT token is expired
 * @param token - JWT token string
 * @param bufferSeconds - Buffer time in seconds before actual expiry (default: 60)
 * @returns true if token is expired or invalid
 */
export function isTokenExpired(token: string, bufferSeconds: number = 60): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('isTokenExpired: Invalid JWT format');
      return true;
    }
    
    const payload = JSON.parse(atob(parts[1]));
    
    // Check for required claims
    if (!payload.sub) {
      console.warn('isTokenExpired: Missing sub claim');
      return true;
    }
    
    if (!payload.exp) {
      console.log('isTokenExpired: No expiry set, assuming valid');
      return false;
    }
    
    // Check if expired (with buffer)
    const expiryTime = payload.exp * 1000;
    const now = Date.now();
    const isExpired = expiryTime < now + (bufferSeconds * 1000);
    
    if (isExpired) {
      const expDate = new Date(expiryTime);
      const minutesAgo = Math.floor((now - expiryTime) / 1000 / 60);
      console.warn(`isTokenExpired: Token expired ${minutesAgo} minutes ago (at ${expDate.toISOString()})`);
    }
    
    return isExpired;
  } catch (e) {
    console.error('isTokenExpired: Error parsing token:', e);
    return true;
  }
}

/**
 * Clear localStorage while preserving important settings
 * @param preserveKeys - Array of keys to preserve (default: ['app-theme'])
 */
export function clearStoragePreservingSettings(preserveKeys: string[] = ['app-theme']): void {
  console.log('clearStoragePreservingSettings: Clearing localStorage...');
  
  // Save values to preserve
  const preserved: Record<string, string | null> = {};
  preserveKeys.forEach(key => {
    preserved[key] = localStorage.getItem(key);
  });
  
  // Clear everything
  localStorage.clear();
  
  // Restore preserved values
  Object.entries(preserved).forEach(([key, value]) => {
    if (value !== null) {
      localStorage.setItem(key, value);
      console.log(`clearStoragePreservingSettings: Restored ${key}`);
    }
  });
  
  console.log('clearStoragePreservingSettings: Complete');
}

/**
 * Validate and clean token from localStorage on app startup
 * This should be called as early as possible
 */
export function validateAndCleanToken(): boolean {
  const token = localStorage.getItem('access_token');
  
  if (!token) {
    console.log('validateAndCleanToken: No token found');
    return false;
  }
  
  console.log('validateAndCleanToken: Checking token...');
  
  if (isTokenExpired(token, 0)) {
    console.warn('validateAndCleanToken: Token is expired, clearing...');
    clearStoragePreservingSettings();
    return false;
  }
  
  console.log('validateAndCleanToken: Token is valid');
  return true;
}

/**
 * Get token info for debugging
 */
export function getTokenInfo(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { error: 'Invalid JWT format' };
    
    const payload = JSON.parse(atob(parts[1]));
    const now = Date.now();
    
    const info: any = {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    
    if (payload.exp) {
      const expDate = new Date(payload.exp * 1000);
      info.expiresAt = expDate.toISOString();
      info.expiresIn = Math.floor((payload.exp * 1000 - now) / 1000 / 60) + ' minutes';
      info.isExpired = payload.exp * 1000 < now;
    }
    
    if (payload.iat) {
      info.issuedAt = new Date(payload.iat * 1000).toISOString();
    }
    
    return info;
  } catch (e) {
    return { error: 'Failed to parse token', details: e };
  }
}
