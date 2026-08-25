import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

function parseArgs( argv ) {

	return Object.fromEntries( argv.map( argument => {

		const [ key, ...value ] = argument.replace( /^--/, '' ).split( '=' );
		return [ key, value.join( '=' ) ];

	} ) );

}

function median( values ) {

	const sorted = [ ...values ].sort( ( a, b ) => a - b );
	const middle = Math.floor( sorted.length / 2 );
	return sorted.length % 2 ? sorted[ middle ] : ( sorted[ middle - 1 ] + sorted[ middle ] ) / 2;

}

function runOne( SphereClass, center, iterations ) {

	let checksum = 0;
	let sphereFlags = 0;
	const start = performance.now();

	for ( let i = 0; i < iterations; i ++ ) {

		const sphere = new SphereClass( center, i & 1023 );
		checksum = ( checksum + sphere.radius ) | 0;
		if ( sphere.isSphere === true ) sphereFlags ++;

	}

	return { elapsedMs: performance.now() - start, checksum, sphereFlags };

}

const args = parseArgs( process.argv.slice( 2 ) );
const beforeRepo = resolve( args.before );
const afterRepo = resolve( args.after );
const iterations = Number( args.iterations ?? 1_500_000 );
const trials = Number( args.trials ?? 10 );
const { Sphere: BeforeSphere } = await import( pathToFileURL( resolve( beforeRepo, 'src/math/Sphere.js' ) ).href );
const { Sphere: AfterSphere } = await import( pathToFileURL( resolve( afterRepo, 'src/math/Sphere.js' ) ).href );
const center = { x: 1, y: 2, z: 3 };

runOne( BeforeSphere, center, 50_000 );
runOne( AfterSphere, center, 50_000 );

const rows = [];

for ( let trial = 0; trial < trials; trial ++ ) {

	// AB/BA 交替，抵消温度、页缓存和运行顺序造成的系统性偏差。
	const order = trial % 2 === 0 ? [ 'before', 'after' ] : [ 'after', 'before' ];

	for ( const variant of order ) {

		globalThis.gc?.();
		const SphereClass = variant === 'before' ? BeforeSphere : AfterSphere;
		rows.push( { trial, variant, ...runOne( SphereClass, center, iterations ) } );

	}

}

const beforeTimes = rows.filter( row => row.variant === 'before' ).map( row => row.elapsedMs );
const afterTimes = rows.filter( row => row.variant === 'after' ).map( row => row.elapsedMs );
const beforeMedianMs = median( beforeTimes );
const afterMedianMs = median( afterTimes );

console.log( JSON.stringify( {
	iterations,
	trials,
	orderPolicy: 'AB/BA alternating',
	beforeMedianMs: Number( beforeMedianMs.toFixed( 3 ) ),
	afterMedianMs: Number( afterMedianMs.toFixed( 3 ) ),
	deltaMs: Number( ( afterMedianMs - beforeMedianMs ).toFixed( 3 ) ),
	deltaPercent: Number( ( ( afterMedianMs / beforeMedianMs - 1 ) * 100 ).toFixed( 3 ) ),
	rows: rows.map( row => ( { ...row, elapsedMs: Number( row.elapsedMs.toFixed( 3 ) ) } ) )
} ) );
