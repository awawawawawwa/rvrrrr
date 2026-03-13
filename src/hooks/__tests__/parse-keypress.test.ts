import {describe, it, expect} from 'vitest';
import {parseKeypress} from '../parse-keypress.js';

function key(overrides: Partial<ReturnType<typeof parseKeypress>['key']> = {}) {
	return {
		upArrow: false,
		downArrow: false,
		leftArrow: false,
		rightArrow: false,
		pageDown: false,
		pageUp: false,
		return: false,
		escape: false,
		ctrl: false,
		shift: false,
		tab: false,
		backspace: false,
		delete: false,
		meta: false,
		...overrides,
	};
}

describe('parseKeypress', () => {
	it('parses up arrow (\\x1b[A)', () => {
		const result = parseKeypress(Buffer.from('\x1b[A'));
		expect(result).toEqual({input: '', key: key({upArrow: true})});
	});

	it('parses down arrow (\\x1b[B)', () => {
		const result = parseKeypress(Buffer.from('\x1b[B'));
		expect(result).toEqual({input: '', key: key({downArrow: true})});
	});

	it('parses right arrow (\\x1b[C)', () => {
		const result = parseKeypress(Buffer.from('\x1b[C'));
		expect(result).toEqual({input: '', key: key({rightArrow: true})});
	});

	it('parses left arrow (\\x1b[D)', () => {
		const result = parseKeypress(Buffer.from('\x1b[D'));
		expect(result).toEqual({input: '', key: key({leftArrow: true})});
	});

	it('parses return (\\r)', () => {
		const result = parseKeypress(Buffer.from('\r'));
		expect(result).toEqual({input: '', key: key({return: true})});
	});

	it('parses escape (\\x1b alone)', () => {
		const result = parseKeypress(Buffer.from('\x1b'));
		expect(result).toEqual({input: '', key: key({escape: true})});
	});

	it('parses tab (\\t)', () => {
		const result = parseKeypress(Buffer.from('\t'));
		expect(result).toEqual({input: '', key: key({tab: true})});
	});

	it('parses backspace (\\x7f)', () => {
		const result = parseKeypress(Buffer.from('\x7f'));
		expect(result).toEqual({input: '', key: key({backspace: true})});
	});

	it('parses delete (\\x1b[3~)', () => {
		const result = parseKeypress(Buffer.from('\x1b[3~'));
		expect(result).toEqual({input: '', key: key({delete: true})});
	});

	it('parses page up (\\x1b[5~)', () => {
		const result = parseKeypress(Buffer.from('\x1b[5~'));
		expect(result).toEqual({input: '', key: key({pageUp: true})});
	});

	it('parses page down (\\x1b[6~)', () => {
		const result = parseKeypress(Buffer.from('\x1b[6~'));
		expect(result).toEqual({input: '', key: key({pageDown: true})});
	});

	it('parses ctrl+a (\\x01)', () => {
		const result = parseKeypress(Buffer.from('\x01'));
		expect(result).toEqual({input: 'a', key: key({ctrl: true})});
	});

	it('parses ctrl+z (\\x1a)', () => {
		const result = parseKeypress(Buffer.from('\x1a'));
		expect(result).toEqual({input: 'z', key: key({ctrl: true})});
	});

	it('parses meta+a (\\x1ba)', () => {
		const result = parseKeypress(Buffer.from('\x1ba'));
		expect(result).toEqual({input: 'a', key: key({meta: true})});
	});

	it('parses plain character "a"', () => {
		const result = parseKeypress(Buffer.from('a'));
		expect(result).toEqual({input: 'a', key: key()});
	});

	it('parses shift+up arrow (\\x1b[1;2A)', () => {
		const result = parseKeypress(Buffer.from('\x1b[1;2A'));
		expect(result).toEqual({input: '', key: key({upArrow: true, shift: true})});
	});

	it('parses plain character "Z"', () => {
		const result = parseKeypress(Buffer.from('Z'));
		expect(result).toEqual({input: 'Z', key: key()});
	});
});
