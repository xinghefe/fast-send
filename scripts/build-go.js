import { execSync, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

const targets = [
  { goos: 'windows', goarch: 'amd64', label: 'win-x64', ext: '.exe' },
  { goos: 'windows', goarch: 'arm64', label: 'win-arm64', ext: '.exe' },
  { goos: 'windows', goarch: '386', label: 'win-x86', ext: '.exe' },
  { goos: 'linux', goarch: 'amd64', label: 'linux-x64', ext: '' },
  { goos: 'linux', goarch: 'arm64', label: 'linux-arm64', ext: '' },
  { goos: 'darwin', goarch: 'amd64', label: 'macos-x64', ext: '' },
  { goos: 'darwin', goarch: 'arm64', label: 'macos-arm64', ext: '' },
];

const outDir = path.resolve('out');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const serverDir = path.resolve('packages/server-go');

const rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = rootPkg.version;
const namePrefix = `FastSend_v${version}`;

console.log(`Building for v${version}...`);

// 生成 Windows 资源文件（串行，很快）
if (targets.some(t => t.goos === 'windows')) {
  try {
    execSync('go-winres make', { cwd: serverDir, stdio: 'inherit' });
  } catch (err) {
    console.warn('go-winres failed, continuing without it');
  }
}

// 并行构建所有目标
async function buildTarget(target, isGUI) {
  const { goos, goarch, label, ext } = target;
  const typeLabel = isGUI ? 'GUI' : 'CLI';
  const outFile = isGUI
    ? path.join(outDir, `${namePrefix}_${label}${ext}`)
    : path.join(outDir, `${namePrefix}_cli_${label}${ext}`);
  const ldFlags = isGUI
    ? ['-s', '-w', '-H windowsgui']
    : ['-s', '-w'];

  const env = {
    ...process.env,
    GOOS: goos,
    GOARCH: goarch,
    CGO_ENABLED: '0',
  };

  try {
    await execAsync(
      `go build -ldflags="${ldFlags.join(' ')}" -o "${outFile}"`,
      { cwd: serverDir, env }
    );
    return { label, type: typeLabel, status: 'ok' };
  } catch (err) {
    const msg = err.stderr ? err.stderr.trim() : err.message;
    return { label, type: typeLabel, status: 'fail', error: msg };
  }
}

const builds = [];
for (const target of targets) {
  builds.push(buildTarget(target, false));
  if (target.goos === 'windows') {
    builds.push(buildTarget(target, true));
  }
}

console.log(`Building ${builds.length} binaries in parallel...\n`);

for (const b of builds) {
  b.then(r => {
    if (r.status === 'ok') {
      console.log(`  ✅ ${r.label} ${r.type}`);
    } else {
      console.log(`  ❌ ${r.label} ${r.type}\n     ${r.error}`);
    }
  });
}

const results = await Promise.allSettled(builds);
const ok = results.filter(r => r.status === 'fulfilled' && r.value.status === 'ok');
const fail = results.filter(r => r.status === 'fulfilled' && r.value.status === 'fail');

console.log(`\nDone: ${ok.length} succeeded, ${fail.length} failed`);
