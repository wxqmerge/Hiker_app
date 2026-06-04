#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const sharedSrc = path.join(projectRoot, 'shared');
const sharedTemp = path.join(projectRoot, 'shared', '.temp-compile');

if (fs.existsSync(sharedTemp)) {
  fs.rmSync(sharedTemp, { recursive: true, force: true });
}
fs.mkdirSync(sharedTemp, { recursive: true });

function copyTsFiles(dir, tempBase) {
  for (const file of fs.readdirSync(dir)) {
    if (file === '.temp-compile') continue;
    const src = path.join(dir, file);
    const dest = path.join(tempBase, file);
    const stat = fs.statSync(src);

    if (stat.isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      copyTsFiles(src, dest);
    } else if (file.endsWith('.ts') && !file.endsWith('.test.ts')) {
      fs.copyFileSync(src, dest);
    }
  }
}

copyTsFiles(sharedSrc, sharedTemp);

const tsconfigContent = {
  compilerOptions: {
    target: 'ES2020',
    module: 'NodeNext',
    lib: ['ES2020', 'DOM'],
    outDir: sharedTemp,
    rootDir: sharedTemp,
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    resolveJsonModule: true,
    declaration: false,
    declarationMap: false,
    sourceMap: false,
    moduleResolution: 'NodeNext',
  },
  include: ['**/*.ts'],
  exclude: ['node_modules', 'dist', '.temp-compile', '**/*.test.ts'],
};

const tempTsconfig = path.join(sharedTemp, 'tsconfig.json');
fs.writeFileSync(tempTsconfig, JSON.stringify(tsconfigContent, null, 2));

try {
  execSync(`npx tsc --project ${tempTsconfig}`, { cwd: sharedTemp, stdio: 'inherit' });

  let count = 0;
  function copyJsFiles(dir, destBase) {
    for (const file of fs.readdirSync(dir)) {
      if (file === '.temp-compile') continue;
      const src = path.join(dir, file);
      const dest = path.join(destBase, file);
      const stat = fs.statSync(src);

      if (stat.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        copyJsFiles(src, dest);
      } else if (file.endsWith('.js')) {
        fs.copyFileSync(src, dest);
        console.log(`  Copied: ${path.relative(sharedSrc, dest)}`);
        count++;
      }
    }
  }

  copyJsFiles(sharedTemp, sharedSrc);
  console.log(`Shared files compiled successfully (${count} files).`);
} catch (err) {
  console.error('Compilation failed:', err.message);
  process.exit(1);
} finally {
  if (fs.existsSync(sharedTemp)) {
    fs.rmSync(sharedTemp, { recursive: true, force: true });
  }
}
