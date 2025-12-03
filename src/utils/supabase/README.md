# Supabase Client Singleton

## Overview

This directory contains the Supabase client configuration for the browser environment.

## Important: Single Client Instance

**⚠️ CRITICAL: Only use the exported `supabase` client from `client.ts`**

Creating multiple Supabase client instances in the same browser context will cause warnings and potentially undefined behavior. The warning you might see:

```
Multiple GoTrueClient instances detected in the same browser context.
```

## Usage

### ✅ Correct Usage

Always import the singleton instance:

```typescript
import { supabase } from '../../utils/supabase/client';

// Use the client
const { data, error } = await supabase.auth.resetPasswordForEmail(email);
```

### ❌ Incorrect Usage

**Never** create new client instances:

```typescript
// DON'T DO THIS!
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(url, key); // ❌ Creates duplicate client
```

## Files

### `client.ts`

Exports the single Supabase client instance for the entire application.

**Configuration:**
- `persistSession: true` - Sessions persist across page reloads
- `autoRefreshToken: true` - Automatically refresh expired tokens
- `detectSessionInUrl: true` - Detect auth redirects (for password reset)
- `storageKey: 'envelope-auth-token'` - Custom storage key for auth tokens

### `info.tsx`

Exports Supabase project configuration (project ID and anon key).

## Common Use Cases

### Password Reset

```typescript
import { supabase } from '../../utils/supabase/client';

// Request password reset
const { error } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/#reset-password`,
});
```

### Update Password

```typescript
import { supabase } from '../../utils/supabase/client';

// Update password (after reset)
const { error } = await supabase.auth.updateUser({
  password: newPassword
});
```

### Check Session

```typescript
import { supabase } from '../../utils/supabase/client';

// Get current session
const { data: { session } } = await supabase.auth.getSession();
```

### Sign Out

```typescript
import { supabase } from '../../utils/supabase/client';

// Sign out user
await supabase.auth.signOut();
```

## Why Singleton Pattern?

1. **Prevents conflicts**: Multiple auth clients can cause race conditions
2. **Consistent state**: Single source of truth for auth state
3. **Better performance**: Reuses connections and listeners
4. **Proper session management**: One client manages one session

## Server vs Client

**Important distinction:**

- **Client** (`/utils/supabase/client.ts`): Browser Supabase client (singleton)
  - Uses `@supabase/supabase-js` package
  - Import: `import { supabase } from '../../utils/supabase/client'`

- **Server** (`/supabase/functions/server/`): Deno Edge Function clients
  - Uses `jsr:@supabase/supabase-js@2` (Deno import)
  - Multiple instances are OK on server (different contexts)

## Troubleshooting

### "Multiple GoTrueClient instances" warning

**Cause**: Creating multiple Supabase clients

**Solution**: 
1. Check all imports - should use `import { supabase } from '../../utils/supabase/client'`
2. Remove any `createClient()` calls in components
3. Always use the singleton instance

### Auth state not persisting

**Cause**: Custom storage configuration issue

**Solution**:
1. Check that `storageKey` is consistent
2. Verify `localStorage` is available
3. Check browser console for storage errors

### Password reset not working

**Cause**: Session detection disabled

**Solution**:
1. Ensure `detectSessionInUrl: true` in client config
2. Verify redirect URL matches Site URL in Supabase Dashboard
3. Check that hash `#reset-password` is in redirect URL

## Best Practices

1. **Import once**: Import the client at the top of your component
2. **No re-creation**: Never call `createClient()` in your code
3. **Use async/await**: All Supabase methods are async
4. **Handle errors**: Always check for errors in responses
5. **Type safety**: Use TypeScript for better type checking

## Related Documentation

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Password Reset Setup](../../guidelines/Password-Reset-Setup.md)
- [Client API Reference](https://supabase.com/docs/reference/javascript/auth-api)
