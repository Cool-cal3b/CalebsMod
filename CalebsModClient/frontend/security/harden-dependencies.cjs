// GHSA-fc5q-39xc-vjpf has no published patched release (2026-11-17).
// Reject repeated extglobs before compiling a regex, including the fast path.
// Keep the upstream version so scanners continue to identify the dependency.
const fs = require('node:fs');
const path = require('node:path');
const marker = '// SECURITY: reject repeated extglobs (GHSA-fc5q-39xc-vjpf)';
const guard = `\n  ${marker}\n  if (typeof input === 'string') {\n    input = input.replace(/\\+\\((\\*[A-Za-z0-9_.-]+(?:\\|\\*[A-Za-z0-9_.-]+)+)\\)/g, '@($1)');\n    for (const match of input.matchAll(/[+*]\\(([^)]*)\\)/g)) {\n      const alternatives = match[1].split('|');\n      if (alternatives.some(value => !/^[A-Za-z0-9_.-]+$/.test(value)) || alternatives.some((a, i) => alternatives.some((b, j) => i !== j && b.startsWith(a)))) {\n        throw new SyntaxError('Ambiguous repeated extglobs are disabled for security');\n      }\n    }\n  }`;
let count = 0;
let minimatchCount = 0;
function visit(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const current = path.join(dir, entry.name);
    if (entry.name === 'minimatch' && fs.existsSync(path.join(current, 'package.json'))) {
      const version = JSON.parse(fs.readFileSync(path.join(current, 'package.json'), 'utf8')).version;
      if (/^(7|8|9|10)\./.test(version) || version === '11.0.0') {
        for (const format of ['commonjs', 'esm']) {
          const file = path.join(current, 'dist', format, 'index.js');
          if (!fs.existsSync(file)) throw new Error('Unsupported bundled minimatch; review required');
          let source = fs.readFileSync(file, 'utf8');
          const original = 'const { optimizationLevel = 1 } = this.options;';
          const replacement = 'const optimizationLevel = 1; // SECURITY: GHSA-g3hv-75wg-m249';
          if (!source.includes(original) && !source.includes(replacement)) throw new Error('Unsupported minimatch optimizer');
          source = source.split(original).join(replacement);
          fs.writeFileSync(file, source);
        }
        minimatchCount++;
        console.log('Verified bundled minimatch optimization-level mitigation');
      }
    }
    if (entry.name === 'picomatch' && fs.existsSync(path.join(current, 'lib', 'parse.js'))) {
      const file = path.join(current, 'lib', 'parse.js');
      let source = fs.readFileSync(file, 'utf8');
      source = source.replace(/\n  \/\/ SECURITY: reject repeated extglobs \(GHSA-fc5q-39xc-vjpf\)\n  if \(typeof input === 'string' && \/\[\+\*\]\\\(\/.test\(input\)\) throw new SyntaxError\('Repeated extglobs are disabled for security'\);/g, '');
      for (const signature of ['const parse = (input, options) => {', 'parse.fastpaths = (input, options) => {']) {
        if (!source.includes(signature)) throw new Error('Unsupported picomatch parser; security mitigation requires review');
        if (!source.includes(signature + guard)) source = source.replace(signature, signature + guard);
      }
      fs.writeFileSync(file, source);
      delete require.cache[require.resolve(file)];
      const parse = require(file);
      for (const input of ['+(*)', '+(*a)', '*(a|aa)']) {
        for (const fn of [parse, parse.fastpaths]) {
          let rejected = false;
          try { fn(input, {}); } catch (error) { rejected = error instanceof SyntaxError; }
          if (!rejected) throw new Error('Picomatch mitigation verification failed');
        }
      }
      const pm = require(path.join(current, 'index.js'));
      if (!pm('+(*Package.java|*Package.kt)')('ExamplePackage.kt')) throw new Error('Autolinking glob regression');
      if (!pm('**/*.ts')('src/index.ts')) throw new Error('Ordinary glob regression');
      count++;
    }
    visit(current);
  }
}
visit(path.join(process.cwd(), 'node_modules'));
console.log(`Verified repeated-extglob protection in ${count} picomatch installations`);
module.exports = {count, minimatchCount};
