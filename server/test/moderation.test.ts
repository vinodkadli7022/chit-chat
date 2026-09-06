import { checkProfanity } from '../src/moderation/profanity';
import { validateImageMagicBytes } from '../src/utils/fileValidation';

function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING SERVER-SIDE MODERATION & SECURITY TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // --- Profanity Evasion Tests ---
  console.log('--- 1. Testing Profanity Anti-Bypass Pipeline ---');

  // Test standard curse words
  assert(!checkProfanity('This is bullshit').isClean, 'Direct curse word is blocked');
  assert(!checkProfanity('What the fuck').isClean, 'High severity curse word is blocked');

  // Test casing bypass
  assert(!checkProfanity('what the FuCk is this').isClean, 'Casing evasion (FuCk) is blocked');

  // Test spaced out letters
  assert(!checkProfanity('f u c k this').isClean, 'Spaced letters (f u c k) are blocked');
  assert(!checkProfanity('s  h  i  t').isClean, 'Multi-spaced letters (s  h  i  t) are blocked');

  // Test punctuation delimiters
  assert(!checkProfanity('f.u.c.k that').isClean, 'Dot delimiter (f.u.c.k) is blocked');
  assert(!checkProfanity('f-u-c-k that').isClean, 'Dash delimiter (f-u-c-k) is blocked');
  assert(!checkProfanity('f_u_c_k that').isClean, 'Underscore delimiter (f_u_c_k) is blocked');

  // Test repeated characters
  assert(!checkProfanity('fuuuuuck').isClean, 'Repeated characters (fuuuuuck) are blocked');
  assert(!checkProfanity('shiiiit').isClean, 'Repeated characters (shiiiit) are blocked');
  assert(!checkProfanity('biiiitch').isClean, 'Repeated characters (biiiitch) are blocked');

  // Test leetspeak substitutions
  assert(!checkProfanity('@sshole').isClean, 'Leetspeak @sshole is blocked');
  assert(!checkProfanity('b!tch').isClean, 'Leetspeak b!tch is blocked');
  assert(!checkProfanity('phuck you').isClean, 'Phonetic phuck is blocked');
  assert(!checkProfanity('5hit').isClean, 'Number replacement 5hit is blocked');

  // Test zero-width space bypass
  const zeroWidthText = 'f\u200Bu\u200Bc\u200Bk';
  assert(!checkProfanity(zeroWidthText).isClean, 'Zero-width space evasion is blocked');

  // Test false positive prevention
  console.log('\n--- 2. Testing False Positive Safeguards ---');
  assert(checkProfanity('This is a classic book').isClean, 'Safe word "classic" is allowed');
  assert(checkProfanity('Can you assist me with the document?').isClean, 'Safe word "assist" is allowed');
  assert(checkProfanity('The grass is green').isClean, 'Safe word "grass" is allowed');
  assert(checkProfanity('What is the title of the article?').isClean, 'Safe word "title" is allowed');
  assert(checkProfanity('Hello how are you doing today?').isClean, 'Standard friendly greeting is allowed');

  // --- Magic Byte Validation Tests ---
  console.log('\n--- 3. Testing Magic Byte MIME Verification ---');
  const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  const fakeImageBuffer = Buffer.from('malicious executable script masquerading as image.png');

  assert(validateImageMagicBytes(jpegBuffer).isValid, 'Authentic JPEG magic bytes recognized');
  assert(validateImageMagicBytes(pngBuffer).isValid, 'Authentic PNG magic bytes recognized');
  assert(!validateImageMagicBytes(fakeImageBuffer).isValid, 'Fake image with spoofed extension is rejected');

  console.log('\n====================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
