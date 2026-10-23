const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const htmlPath = path.join(process.cwd(), 'index.html');
if (!fs.existsSync(htmlPath)) {
  console.error('index.html was not found in the repository root.');
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf8');
const inlineScripts = [...html.matchAll(/<script\\b([^>]*)>([\\s\\S]*?)<\\/script>/gi)]
  .filter((match) => !/\\bsrc\\s*=/.test(match[1]))
  .map((match) => match[2])
  .filter((script) => script.trim().length > 0);

if (inlineScripts.length === 0) {
  console.error('No inline JavaScript blocks were found to validate.');
  process.exit(1);
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dial-ledger-js-'));
let failed = false;
try {
  inlineScripts.forEach((script, index) => {
    const file = path.join(tempDir, `inline-${index + 1}.js`);
    fs.writeFileSync(file, script, 'utf8');
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) {
      failed = true;
      console.error(`Syntax check failed for inline script ${index + 1}:`);
      process.stderr.write(result.stderr || result.stdout || 'Node syntax check failed.\\n');
    } else {
      console.log(`PASS: inline script ${index + 1} syntax`);
    }
  });
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

if (failed) process.exit(1);
console.log(`Validated ${inlineScripts.length} inline JavaScript block(s).`);
