// @vitest-environment node
import {describe, it, expect, vi, afterEach} from 'vitest';
import {patchConsole} from '../patch-console.js';

describe('patchConsole', () => {
	afterEach(() => {
		// Restore originals after each test in case restore wasn't called
	});

	it('intercepts console.log', () => {
		const writes: string[] = [];
		const restore = patchConsole((text) => {
			writes.push(text);
		});

		console.log('hello');

		restore();

		expect(writes).toHaveLength(1);
		expect(writes[0]).toContain('hello');
	});

	it('intercepts console.warn', () => {
		const writes: string[] = [];
		const restore = patchConsole((text) => {
			writes.push(text);
		});

		console.warn('warning message');

		restore();

		expect(writes).toHaveLength(1);
		expect(writes[0]).toContain('warning message');
	});

	it('intercepts console.error', () => {
		const writes: string[] = [];
		const restore = patchConsole((text) => {
			writes.push(text);
		});

		console.error('error message');

		restore();

		expect(writes).toHaveLength(1);
		expect(writes[0]).toContain('error message');
	});

	it('restore function puts originals back', () => {
		const originalLog = console.log;
		const writes: string[] = [];
		const restore = patchConsole((text) => {
			writes.push(text);
		});

		restore();

		// After restore, console.log should be original again
		expect(console.log).toBe(originalLog);
	});

	it('appends newline to output', () => {
		const writes: string[] = [];
		const restore = patchConsole((text) => {
			writes.push(text);
		});

		console.log('test');

		restore();

		expect(writes[0]).toMatch(/\n$/);
	});

	it('formats multiple arguments with util.format', () => {
		const writes: string[] = [];
		const restore = patchConsole((text) => {
			writes.push(text);
		});

		console.log('value: %d', 42);

		restore();

		expect(writes[0]).toContain('value: 42');
	});
});
