import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

function parseArgs(argv) {

	const result = {};

	for ( const argument of argv ) {

		const [ key, ...parts ] = argument.replace( /^--/, '' ).split( '=' );
		result[ key ] = parts.join( '=' );

	}

	return result;

}

const args = parseArgs( process.argv.slice( 2 ) );
const repoRoot = resolve( args.repo ?? './upstream' );
const iterations = Number( args.iterations ?? 3_000_000 );
const rounds = Number( args.rounds ?? 4 );
const expected = args.expected ?? 'none';

const sphereModule = await import(
	pathToFileURL( resolve( repoRoot, 'src/math/Sphere.js' ) ).href
);
const vectorModule = await import(
	pathToFileURL( resolve( repoRoot, 'src/math/Vector3.js' ) ).href
);

const { Sphere } = sphereModule;
const { Vector3 } = vectorModule;

// 保持具名函数，便于在 CPU Profile 与 Ignition 字节码中稳定定位。
function runSphereWorkload( SphereClass, center, count ) {

	let checksum = 0;
	let sphereFlags = 0;

	for ( let i = 0; i < count; i ++ ) {

		const sphere = new SphereClass( center, i & 1023 );
		checksum = ( checksum + sphere.radius ) | 0;

		if ( sphere.isSphere === true ) sphereFlags ++;

	}

	return { checksum, sphereFlags };

}

const center = new Vector3( 1, 2, 3 );

// 短预热只用于稳定模块加载、页缓存和 GC 初始状态；采集时使用 --jitless，
// 因而不会进入 Maglev/TurboFan，热点仍在 Ignition 路径内。
runSphereWorkload( Sphere, center, Math.min( iterations, 50_000 ) );

const measurements = [];
let finalResult;

for ( let round = 0; round < rounds; round ++ ) {

	const start = performance.now();
	finalResult = runSphereWorkload( Sphere, center, iterations );
	measurements.push( performance.now() - start );

}

const sorted = [ ...measurements ].sort( ( a, b ) => a - b );
const medianMs = sorted[ Math.floor( sorted.length / 2 ) ];
const actualFixed = finalResult.sphereFlags === iterations;

const output = {
	repoRoot,
	iterations,
	rounds,
	measurementsMs: measurements.map( value => Number( value.toFixed( 3 ) ) ),
	medianMs: Number( medianMs.toFixed( 3 ) ),
	checksum: finalResult.checksum,
	sphereFlags: finalResult.sphereFlags,
	actualFixed,
	expected
};

console.log( JSON.stringify( output ) );

if ( expected === 'before' && actualFixed ) {

	console.error( 'Expected the original SWE-bench failure, but isSphere was present.' );
	process.exitCode = 2;

} else if ( expected === 'after' && ! actualFixed ) {

	console.error( 'Expected the gold fix, but isSphere was absent.' );
	process.exitCode = 3;

}

