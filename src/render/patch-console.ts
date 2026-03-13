import {format} from 'node:util';

/**
 * Intercept console.log, console.warn, and console.error so they call
 * the provided write function instead of writing directly to stdout/stderr.
 * This prevents terminal corruption when Ink controls the output stream.
 *
 * Returns a restore function that puts the original console methods back.
 */
export function patchConsole(write: (text: string) => void): () => void {
	const orig = {
		log: console.log,
		warn: console.warn,
		error: console.error,
	};

	console.log = (...args: unknown[]) => {
		write(format(...args) + '\n');
	};

	console.warn = (...args: unknown[]) => {
		write(format(...args) + '\n');
	};

	console.error = (...args: unknown[]) => {
		write(format(...args) + '\n');
	};

	return () => {
		console.log = orig.log;
		console.warn = orig.warn;
		console.error = orig.error;
	};
}
