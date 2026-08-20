import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'download-dependencies.manifest.json'), 'utf8'));
const build = await readFile(path.join(root, 'build.bat'), 'utf8');
const installer = await readFile(path.join(root, 'build-installer.bat'), 'utf8');
const fetcher = await readFile(path.join(root, 'scripts', 'download-dependencies.ps1'), 'utf8');

assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.dependencies.length, 1);
assert.deepEqual(manifest.dependencies[0], {
  id: 'node-runtime-win-x64',
  version: '22.23.2',
  url: 'https://nodejs.org/dist/v22.23.2/node-v22.23.2-win-x64.zip',
  sha256: '1177b4137ba5adaa56354ae40f1080c7450e8ae09cecb47da459d1c52ac99f97',
  archiveRoot: 'node-v22.23.2-win-x64',
  destination: '.tools/node-v22.23.2-win-x64',
});
for (const [name, script] of [['build.bat', build], ['build-installer.bat', installer]]) {
  assert.match(script, /^call "%SHV_ROOT%download-dependencies\.bat" \/s$/m, `${name} must call the shared dependency fetcher.`);
  assert.match(script, /\.tools\\node-v22\.23\.2-win-x64/, `${name} must use the pinned prepared runtime.`);
  assert.match(script, /call npm ci --no-audit/, `${name} must install the committed lock.`);
}
assert.match(fetcher, /System\.Security\.Cryptography\.SHA256/);
assert.match(fetcher, /Invoke-WebRequest -Uri \$dependency\.url/);
assert.doesNotMatch(fetcher, /winget|choco|scoop|Start-Process/i);
process.stdout.write('PASS: dependency bootstrap contract is pinned, shared, silent-capable, and digest-verified.\n');
