// Run with: node --test scripts/driver-entry.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
function loadTypeScript(relativePath, dependencies) {
  const filename = path.join(root, relativePath);
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  });
  const module = { exports: {} };
  vm.runInNewContext(outputText, {
    module,
    exports: module.exports,
    require(name) {
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      throw new Error(`Unexpected dependency: ${name}`);
    },
    process: { env: {} },
    console: { error() {}, warn() {}, log() {} },
  }, { filename });
  return module.exports;
}

let response;
const service = loadTypeScript('lib/firestoreOnboardingService.ts', {
  'react-native': { Platform: { OS: 'web' }, Image: {} },
  'expo-image-manipulator': {},
  './fetchWithTimeout': {
    fetchWithTimeout: async () => {
      if (response instanceof Error) throw response;
      return response;
    },
  },
});
const { getDriverEntryScreen } = loadTypeScript('lib/driverEntry.ts', {
  './firestoreOnboardingService': service,
});

const cases = [
  ['OTP only, no driver profile', null, 'details'],
  ['empty profile cannot unlock Home', {}, 'details'],
  ['default pending status is not a submission', { verificationStatus: 'pending' }, 'details'],
  ['creation timestamp is not a submission', { createdAt: '2026-09-17' }, 'details'],
  ['partially filled profile restarts onboarding', { fullName: 'Test Driver', vehicleNumber: 'TEST', verificationStatus: 'pending' }, 'details'],
  ['submitted driver resumes review', { submittedAt: '2026-09-17', verificationStatus: 'pending' }, 'review'],
  ['rejected driver resumes review for corrections', { submittedAt: '2026-09-17', verificationStatus: 'rejected' }, 'review'],
  ['approved driver can enter Home', { verificationStatus: 'verified' }, 'home'],
  ['legacy approval is preserved', { verified: true }, 'home'],
  ['suspension wins over approval', { verified: true, status: 'suspended' }, 'suspended'],
  ['legacy completed profile resumes review', {
    fullName: 'Test Driver', vehicleNumber: 'TEST', bankName: 'Test Bank',
    accountNumber: '123', ifscCode: 'TEST', drivingLicenseUri: 'https://test/license',
    identityProofUri: 'https://test/id', rcBookUri: 'https://test/rc',
    insuranceUri: 'https://test/insurance', verificationStatus: 'pending',
  }, 'review'],
];
for (const [name, profile, expected] of cases) {
  test(name, () => assert.equal(getDriverEntryScreen(profile), expected));
}

test('strict lookup distinguishes missing profiles from failed requests', async () => {
  response = { ok: false, status: 404 };
  assert.equal(await service.getDriverProfile('uid', 'token', true), null);
  response = { ok: false, status: 503 };
  await assert.rejects(service.getDriverProfile('uid', 'token', true));
  response = new Error('offline');
  await assert.rejects(service.getDriverProfile('uid', 'token', true));
  // Existing callers retain their non-throwing behavior.
  assert.equal(await service.getDriverProfile('uid', 'token'), null);
  response = { ok: true, status: 200, json: async () => ({ success: true, data: { submittedAt: 'today' } }) };
  assert.equal((await service.getDriverProfile('uid', 'token', true)).submittedAt, 'today');
  response = { ok: true, status: 200, json: async () => ({}) };
  await assert.rejects(service.getDriverProfile('uid', 'token', true));
});

test('startup ignores the legacy Skip flag and gates the route stack', () => {
  const layout = fs.readFileSync(path.join(root, 'app/_layout.tsx'), 'utf8');
  assert.doesNotMatch(layout, /getItem\('walkthroughCompleted'\)/);
  assert.doesNotMatch(layout, /setItem\('walkthroughCompleted'/);
  assert.match(layout, /getDriverEntryScreen\(profile\)/);
  assert.match(layout, /initialSession=\{resumeSession\}/);
  assert.ok(layout.indexOf('if (showWalkthrough)') < layout.indexOf('<Stack screenOptions'));
});
