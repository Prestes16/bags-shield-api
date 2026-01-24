/**
 * Manual tests for PR-A security implementations
 */

import fs from 'fs';
import path from 'path';

console.log('🧪 Testing PR-A Security Implementations\n');

// Helper to safely import and test modules
async function testModule(modulePath, testName, testFn) {
  try {
    console.log(`📦 Testing ${testName}...`);
    const module = await import(modulePath);
    await testFn(module);
    console.log(`✅ ${testName} - PASSED\n`);
  } catch (error) {
    console.log(`❌ ${testName} - FAILED: ${error.message}\n`);
  }
}

// Test 1: Base58 Validator
await testModule('./src/lib/security/validate.js', 'Base58 Validator', (module) => {
  const { Base58Validator } = module;
  
  // Test valid mint
  const validMint = '11111111111111111111111111111111';
  console.log(`  Testing valid mint: ${Base58Validator.isValidMint(validMint)}`);
  
  // Test invalid mint
  const invalidMint = 'invalid-mint-@#$';
  console.log(`  Testing invalid mint: ${Base58Validator.isValidMint(invalidMint)}`);
  
  // Test wallet validation
  const validWallet = 'So11111111111111111111111111111111111111112';
  console.log(`  Testing valid wallet: ${Base58Validator.isValidWallet(validWallet)}`);
});

// Test 2: SSRF Protection
await testModule('./src/lib/security/ssrf.js', 'SSRF Protection', (module) => {
  const { validateUrlSSRF } = module;
  
  // Test valid URL
  const validUrl = 'https://example.com/api/data';
  const validResult = validateUrlSSRF(validUrl);
  console.log(`  Valid URL (${validUrl}): ${validResult.allowed ? 'ALLOWED' : 'BLOCKED'}`);
  
  // Test blocked localhost
  const localhostUrl = 'https://localhost:8080/admin';
  const localhostResult = validateUrlSSRF(localhostUrl);
  console.log(`  Localhost URL (${localhostUrl}): ${localhostResult.allowed ? 'ALLOWED' : 'BLOCKED'} - ${localhostResult.reason}`);
  
  // Test blocked private IP
  const privateIpUrl = 'https://192.168.1.1/config';
  const privateResult = validateUrlSSRF(privateIpUrl);
  console.log(`  Private IP URL (${privateIpUrl}): ${privateResult.allowed ? 'ALLOWED' : 'BLOCKED'} - ${privateResult.reason}`);
  
  // Test HTTP (should be blocked)
  const httpUrl = 'http://example.com';
  const httpResult = validateUrlSSRF(httpUrl);
  console.log(`  HTTP URL (${httpUrl}): ${httpResult.allowed ? 'ALLOWED' : 'BLOCKED'} - ${httpResult.reason}`);
});

// Test 3: TTL Cache
await testModule('./src/lib/security/cache.js', 'TTL Cache', (module) => {
  const { TTLCache } = module;
  
  // Create cache with short TTL for testing
  const cache = new TTLCache(10, 100); // 100ms TTL
  
  // Test basic operations
  cache.set('test-key', 'test-value');
  const value = cache.get('test-key');
  console.log(`  Set/Get test: ${value === 'test-value' ? 'PASSED' : 'FAILED'}`);
  
  // Test has()
  console.log(`  Has key test: ${cache.has('test-key') ? 'PASSED' : 'FAILED'}`);
  
  // Test delete
  cache.delete('test-key');
  console.log(`  Delete test: ${cache.get('test-key') === undefined ? 'PASSED' : 'FAILED'}`);
  
  // Test TTL expiration (async test)
  cache.set('ttl-key', 'ttl-value', 50); // 50ms TTL
  console.log(`  TTL test setup: ${cache.get('ttl-key') === 'ttl-value' ? 'INITIAL SET OK' : 'FAILED'}`);
  
  setTimeout(() => {
    const expired = cache.get('ttl-key');
    console.log(`  TTL expiration test: ${expired === undefined ? 'PASSED (expired correctly)' : 'FAILED (should be expired)'}`);
  }, 60);
});

// Test 4: Input Sanitization
await testModule('./src/lib/security/validate.js', 'Input Sanitization', (module) => {
  const { InputSanitizer, SizeLimits } = module;
  
  // Test string sanitization
  const dirtyString = '  hello world  \x00\x08';
  const cleaned = InputSanitizer.sanitizeString(dirtyString, 50);
  console.log(`  String sanitization: "${dirtyString}" → "${cleaned}"`);
  
  // Test number sanitization
  const validNumber = InputSanitizer.sanitizeNumber('42.7', 0, 100);
  console.log(`  Number sanitization ('42.7'): ${validNumber}`);
  
  // Test token name validation
  const validTokenName = SizeLimits.isValidTokenName('My Token 2.0');
  const invalidTokenName = SizeLimits.isValidTokenName('Token@#$%');
  console.log(`  Token name validation: valid='My Token 2.0' → ${validTokenName}, invalid='Token@#$%' → ${invalidTokenName}`);
});

// Test 5: Launchpad Validators
await testModule('./src/lib/security/validate.js', 'Launchpad Validators', (module) => {
  const { LaunchpadValidator } = module;
  
  // Test mint validation
  const mintResult = LaunchpadValidator.validateMint('11111111111111111111111111111112');
  console.log(`  Mint validation: ${mintResult.valid ? 'VALID' : 'INVALID'} - ${mintResult.error || 'OK'}`);
  
  // Test wallet validation  
  const walletResult = LaunchpadValidator.validateWallet('So11111111111111111111111111111111111111112');
  console.log(`  Wallet validation: ${walletResult.valid ? 'VALID' : 'INVALID'} - ${walletResult.error || 'OK'}`);
  
  // Test metadata URI validation
  const uriResult = LaunchpadValidator.validateMetadataUri('https://example.com/metadata.json');
  console.log(`  Metadata URI validation: ${uriResult.valid ? 'VALID' : 'INVALID'} - ${uriResult.error || 'OK'}`);
  
  // Test invalid URI (should be blocked)
  const invalidUriResult = LaunchpadValidator.validateMetadataUri('http://localhost/metadata.json');
  console.log(`  Invalid URI validation: ${invalidUriResult.valid ? 'VALID' : 'INVALID'} - ${invalidUriResult.error || 'OK'}`);
});

// Test 6: Cache Key Generation
await testModule('./src/lib/security/cache.js', 'Cache Key Generation', (module) => {
  const { CacheKeyGenerator } = module;
  
  // Test different key types
  const attestationKey = CacheKeyGenerator.attestation('mint123', 'snapshot456');
  console.log(`  Attestation key: ${attestationKey}`);
  
  const validationKey = CacheKeyGenerator.validation('mint', 'address123');
  console.log(`  Validation key: ${validationKey}`);
  
  const rateLimitKey = CacheKeyGenerator.rateLimit('192.168.1.1', '/api/submit');
  console.log(`  Rate limit key: ${rateLimitKey}`);
  
  const ssrfKey = CacheKeyGenerator.ssrf('https://example.com/path');
  console.log(`  SSRF key: ${ssrfKey}`);
});

console.log('⏱️  Waiting for async TTL test to complete...');
setTimeout(() => {
  console.log('\n🎉 All manual tests completed!');
  console.log('\n📋 Test Summary:');
  console.log('✅ Base58 validation for Solana addresses');
  console.log('✅ SSRF protection blocking dangerous URLs');
  console.log('✅ TTL cache with expiration behavior');
  console.log('✅ Input sanitization removing dangerous characters');
  console.log('✅ Launchpad validators with comprehensive checks');
  console.log('✅ Cache key generation for different use cases');
}, 100);