// SPDX-License-Identifier: Apache-2.0
import { readFile } from 'node:fs/promises';
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
const allow = new Set(['MIT', 'Apache-2.0']);
const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies };
const errs = [];
for (const [name, spec] of Object.entries(deps)) {
  if (!lock.packages?.[`node_modules/${name}`]) errs.push(`${name}: not found in package-lock`);
  if (typeof spec !== 'string' || !/^(\d|\^|~)/.test(spec)) errs.push(`${name}: package version must be explicit semver`);
}
for (const [name, value] of Object.entries(lock.packages || {})) {
  if (!name) continue;
  // npm lockfiles usually omit license metadata; require manual license attestation
  // in reviewed dependency inventory before accepting any package addition.
  const license = pkg.licenseAttestations?.[name];
  if (!allow.has(license)) errs.push(`${name}: missing approved MIT/Apache-2.0 license attestation`);
  if (!value.integrity?.startsWith('sha512-')) errs.push(`${name}: missing sha512 integrity pin`);
}
if (pkg.license !== 'Apache-2.0') errs.push('Root project must be Apache-2.0.');
if (errs.length) { console.error(errs.join('\n')); process.exitCode = 1; }
else console.log('License gate passed: Apache-2.0 repository, no unapproved dependencies.');
