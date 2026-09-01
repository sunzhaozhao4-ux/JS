(function installAcornWorkload(globalObject) {
  'use strict';

  function buildSource(moduleCount) {
    const chunks = [];
    for (let index = 0; index < moduleCount; index++) {
      chunks.push(`
        export class Record${index} {
          #value = ${index};
          constructor(name, values = []) {
            this.name = name;
            this.values = [...values];
            this.meta = { index: ${index}, active: index % 2 === 0 };
          }
          *entries() {
            for (const [position, value] of this.values.entries()) {
              yield { position, value, score: value * (this.#value + 1) };
            }
          }
          async summarize(mapper = value => value) {
            const normalized = this.values
              .filter(value => Number.isFinite(value))
              .map(value => mapper(value) ?? 0);
            return normalized.reduce((sum, value) => sum + value, 0);
          }
        }

        export function transform${index}(input, options = {}) {
          const { offset = ${index}, scale = 2, tags = [] } = options;
          return input?.items?.map((item, position) => ({
            id: item.id ?? position,
            score: (item.value + offset) * scale,
            label: (item.name ?? "unknown") + ":" + (tags[position % (tags.length || 1)] ?? "none"),
          })) ?? [];
        }
      `);
    }
    return chunks.join('\n');
  }

  function visitAst(root) {
    const stack = [root];
    const counts = Object.create(null);
    let total = 0;
    while (stack.length) {
      const value = stack.pop();
      if (!value || typeof value !== 'object') continue;
      if (typeof value.type === 'string') {
        counts[value.type] = (counts[value.type] || 0) + 1;
        total++;
      }
      if (Array.isArray(value)) {
        for (let index = value.length - 1; index >= 0; index--) stack.push(value[index]);
      } else {
        for (const key of Object.keys(value)) {
          if (key !== 'start' && key !== 'end' && key !== 'loc') stack.push(value[key]);
        }
      }
    }
    return { counts, total };
  }

  function run({ iterations = 80, moduleCount = 36, parse = true } = {}) {
    const source = buildSource(moduleCount);
    const start = globalObject.performance ? globalObject.performance.now() : Date.now();
    let checksum = 0;
    let nodeCount = 0;
    for (let iteration = 0; iteration < iterations; iteration++) {
      if (parse) {
        const ast = globalObject.acorn.parse(source, {
          ecmaVersion: 'latest', sourceType: 'module', locations: true,
        });
        const visited = visitAst(ast);
        nodeCount += visited.total;
        checksum = (checksum + visited.total * (iteration + 1) + (visited.counts.Identifier || 0)) >>> 0;
      } else {
        // Control group: same source generation and loop count, but no parser/AST walk.
        checksum = (checksum + source.charCodeAt(iteration % source.length) * (iteration + 1)) >>> 0;
      }
    }
    const end = globalObject.performance ? globalObject.performance.now() : Date.now();
    return {
      checksum, elapsed_ms: end - start, iterations, module_count: moduleCount,
      node_count: nodeCount, source_bytes: source.length, workload: parse ? 'acorn' : 'harness-control',
    };
  }

  globalObject.AcornBench = { buildSource, run, visitAst };
})(globalThis);
