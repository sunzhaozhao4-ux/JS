'use strict';

const fs = require('node:fs');
const path = require('node:path');

const labRoot = path.resolve(__dirname, '..');
const candidates = [
  process.env.ACORN_PACKAGE_DIR,
  path.join(labRoot, 'third_party', 'acorn-8.18.0'),
  path.resolve(labRoot, '..', 'browser-js-measurement', 'third_party', 'acorn-8.18.0'),
].filter(Boolean);
const packageDir = candidates.find((candidate) => fs.existsSync(path.join(candidate, 'dist', 'acorn.js')));
if (!packageDir) {
  throw new Error('Acorn 8.18.0 not found. Run scripts/setup_acorn.ps1 first.');
}

globalThis.acorn = require(path.join(packageDir, 'dist', 'acorn.js'));
require('./acorn_workload_core.js');

const iterations = Number(process.env.BENCH_ITERATIONS || process.argv[2] || 80);
const moduleCount = Number(process.env.BENCH_MODULES || process.argv[3] || 36);
const result = globalThis.AcornBench.run({ iterations, moduleCount, parse: true });
result.engine = 'node';
result.v8 = process.versions.v8;
process.stdout.write(`${JSON.stringify(result)}\n`);
