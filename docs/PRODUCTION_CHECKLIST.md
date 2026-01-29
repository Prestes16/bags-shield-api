## Bags Shield Production Stability Verification

### Files Changed (Minimal Patch)
1. `/app/api/scan/route.ts` - Added rate limiting, content-type validation, proper error codes
2. `/app/scan/page.tsx` - Added request deduplication with AbortController refs
3. `/lib/backend-client.ts` - Added APIError class with error codes, improved response validation

### Stability Improvements

#### 1. Request Deduplication (Prevents Double-Fetch)
- **Change**: Added `inFlightRef` and `abortControllerRef` to scan page
- **Effect**: 
  - Skips fetch if same mint already in-flight
  - Aborts previous requests when mint changes
  - Only updates state for current mint (prevents stale updates)
  - Properly cleans up on unmount
- **Verification**: Check Network tab in DevTools - should see only 1 POST per new mint

#### 2. Rate Limiting
- **Change**: Added in-memory rate limit map (30 reqs/minute per IP)
- **Returns**: 429 with "Retry-After: 60" header
- **Effect**: Prevents abuse, graceful degradation
- **Verification**: Rapid scans after limit trigger 429, user sees "Rate limited" message

#### 3. Content-Type Validation
- **Change**: API validates `Content-Type: application/json`
- **Effect**: Rejects malformed requests, prevents parse errors
- **Verification**: Manual check - send POST without Content-Type should fail with 400

#### 4. Error Code System
- **Change**: All API errors now have `status`, `code`, `message`
- **Codes**: `RATE_LIMITED`, `PAYMENT_REQUIRED`, `INVALID_RESPONSE`, `NETWORK_ERROR`, etc.
- **Effect**: Client can distinguish error types and show appropriate messages
- **Verification**: Error messages in UI show rate-limit vs network vs validation errors

#### 5. Metadata Response
- **Change**: All responses include `meta.dataSources`
- **Format**: `{ fromCache, stale, source, dataSources[], timestamp }`
- **Effect**: UI can show cache status, APK can track data freshness
- **Verification**: Check response in DevTools - meta.dataSources should be present

#### 6. Encoding Fix
- **Change**: Updated Loader2 icon to use theme variable `text-[var(--cyan-primary)]`
- **Effect**: No more hardcoded colors, proper theme support
- **Verification**: Icon color matches theme (cyan in dark, green in enthusiast theme)

### Manual Testing Checklist

#### Scan Flow
- [ ] Fresh scan with valid mint → single POST, result displays
- [ ] Back button → previous result still in cache (no refetch)
- [ ] Rapid mint changes → only latest fetches (old requests aborted)
- [ ] Network throttle (slow 3G) → loading state shows, no duplicate requests
- [ ] Rate limit exceeded (30+ rapid scans) → 429, "Rate limited" message, retry works
- [ ] Invalid mint (random string) → error state with proper message

#### Error States
- [ ] Network down → "Network error" message
- [ ] Backend HTML response (misconfigured) → "Invalid response" message
- [ ] 402 Payment Required → shows correctly (Pro Scan flow)
- [ ] JSON parse error → "Response parse error" message

#### Mobile Responsiveness
- [ ] iOS Safari (Phantom wallet) → connect works, scan works
- [ ] Android Chrome (Solflare) → same as above
- [ ] All buttons have 44px minimum touch target
- [ ] No horizontal scroll on any device

#### Metadata & APK Integration
- [ ] All scan responses have `meta.dataSources` present
- [ ] Cache responses show `fromCache: true` and older timestamp
- [ ] Pro Scan responses show `source: "pro-scan"`
- [ ] Timestamp is Unix milliseconds

### Deployment Readiness
- ✓ No new dependencies
- ✓ No new routes (only /api/scan hardened)
- ✓ Backwards compatible with existing UI
- ✓ Theme variables used consistently
- ✓ I18n strings via `t()` helper
- ✓ Rate limiting scoped to dev/prod configs
- ✓ No console.error for expected errors (rate limits, network issues)

### Production Config Notes
- Rate limit: Dev 30/min, Prod 10/min (configurable)
- Cache headers: All `/api/scan` responses are `no-store, must-revalidate`
- Error logging: Only unexpected errors logged (400s are user errors, log 5xx only)

### TWA/APK Integration
- Scan page works in WebView context
- Wallet detection supports mobile wallets (Phantom, Solflare, Backpack)
- Rate limiting respects APK IP range
- Metadata provides all info for offline cache in APK
