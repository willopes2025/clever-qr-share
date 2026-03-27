

## Fix: check-subscription returning 401 due to broken auth

### Root Cause

The shared auth helper (`supabase/functions/_shared/auth.ts`) uses `supabaseClient.auth.getClaims(token)` to validate the JWT. This method is failing with "Auth session missing!" because `getClaims` expects an active session context, not a raw token. This causes ALL edge functions using `requireUser()` to return 401, which triggers the SubscriptionContext to force-logout the user — resulting in a blank screen on `/login`.

### Fix

**File:** `supabase/functions/_shared/auth.ts`

Replace `getClaims(token)` with the standard `getUser()` approach:

```typescript
const { data: { user }, error } = await supabaseClient.auth.getUser();
```

Since the Supabase client is already created with the `Authorization` header, `getUser()` will validate the token server-side and return the user object with `id` and `email`. This is the reliable, documented approach for edge functions.

### Changes

1. Remove the `token` extraction (line 42) — no longer needed
2. Replace `getClaims(token)` call (line 54) with `getUser()`
3. Update the response mapping to use `user.id` and `user.email` instead of `claims.sub` and `claims.email`

### Result

The auth validation will work correctly, check-subscription will return subscription data instead of 401, and the user will be able to log in and stay logged in.

