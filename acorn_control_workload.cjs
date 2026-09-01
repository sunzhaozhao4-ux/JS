'use strict';

require('./acorn_workload_core.js');

const iterations = Number(process.env.BENCH_ITERATIONS || process.argv[2] || 80);
const moduleCount = Number(process.env.BENCH_MODULES || process.argv[3] || 36);
const result = globalThis.AcornBench.run({ iterations, moduleCount, parse: false });
result.engine = 'node';
result.v8 = process.versions.v8;
process.stdout.write(`${JSON.stringify(result)}\n`);
