// Preserve all upstream audit findings; exempt only the mitigation verified above.
const mitigations = require('./harden-dependencies.cjs');
const {spawnSync} = require('node:child_process');
const args = ['audit', '--json', '--ignore-scripts', ...process.argv.slice(2)];
const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args,
  {encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 20 * 1024 * 1024});
if (result.error) throw result.error;
let report;
try { report = JSON.parse(result.stdout); } catch { console.error(result.stderr); process.exit(1); }
if (report.error) { console.error(report.error); process.exit(1); }
const entries = report.vulnerabilities || {};
function unmitigated(name, seen = new Set()) {
  if (seen.has(name)) return false;
  const next = new Set(seen); next.add(name);
  return entries[name]?.via.some(v => typeof v === 'string' ? unmitigated(v, next)
    : !((v.url.endsWith('/GHSA-fc5q-39xc-vjpf') && mitigations.count > 0) || (v.url.endsWith('/GHSA-g3hv-75wg-m249') && mitigations.minimatchCount > 0))) || false;
}
const remaining = Object.keys(entries).filter(name => unmitigated(name));
console.log(JSON.stringify({upstream: report.metadata?.vulnerabilities, unmitigated: remaining.map(name => ({name, severity: entries[name].severity, via: entries[name].via}))}, null, 2));
process.exit(remaining.length ? 1 : 0);
