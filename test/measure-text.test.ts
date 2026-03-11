import {describe, it, expect} from 'vitest';
import measureText from '../src/layout/measure-text.js';

describe('Text Measurement (LYOT-06)', () => {
	it('measures ASCII text', () => {
		const dims = measureText('Hello');
		expect(dims.width).toBe(5);
		expect(dims.height).toBe(1);
	});

	it('measures multi-line text', () => {
		const dims = measureText('Hello\nWorld');
		expect(dims.width).toBe(5);
		expect(dims.height).toBe(2);
	});

	it('handles CJK characters (double-width)', () => {
		const dims = measureText('世界');
		expect(dims.width).toBe(4);
		expect(dims.height).toBe(1);
	});

	it('strips ANSI escape codes when measuring', () => {
		const dims = measureText('\u001b[31mHello\u001b[0m');
		expect(dims.width).toBe(5);
		expect(dims.height).toBe(1);
	});

	it('handles emoji', () => {
		const dims = measureText('👋');
		expect(dims.width).toBe(2);
		expect(dims.height).toBe(1);
	});

	it('returns zero for empty string', () => {
		const dims = measureText('');
		expect(dims.width).toBe(0);
		expect(dims.height).toBe(0);
	});
});
