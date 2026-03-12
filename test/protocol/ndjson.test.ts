import {describe, it, expect} from 'vitest';
import Yoga from 'yoga-layout';
import {createNode, createTextNode, appendChild} from '../../src/dom/dom.js';
import type {DOMElement} from '../../src/dom/types.js';
import applyStyles from '../../src/layout/styles.js';
import {serializeTree} from '../../src/protocol/serialize.js';
import {encodeMessage, encodeMessages} from '../../src/protocol/ndjson.js';
import {
	createErrorMessage,
	ErrorCodes,
} from '../../src/protocol/errors.js';
import type {
	RenderMessage,
	ErrorMessage,
} from '../../src/protocol/types.js';

function buildSimpleTree(): RenderMessage {
	const root = createNode('ink-root');
	const text = createNode('ink-text');
	appendChild(text, createTextNode('hello'));
	appendChild(root, text);
	root.yogaNode!.setWidth(80);
	root.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
	return serializeTree(root);
}

describe('NDJSON encoding', () => {
	it('encodes a single render message', () => {
		const msg = buildSimpleTree();
		const encoded = encodeMessage(msg);

		expect(encoded.endsWith('\n')).toBe(true);
		const parsed = JSON.parse(encoded.trimEnd());
		expect(parsed.type).toBe('render');
		expect(parsed.root.kind).toBe('box');
	});

	it('encodes multiple messages', () => {
		const render = buildSimpleTree();
		const error: ErrorMessage = {
			type: 'error',
			message: 'oops',
		};
		const encoded = encodeMessages([render, error]);

		const lines = encoded.split('\n').filter(l => l.length > 0);
		expect(lines).toHaveLength(2);

		const parsed0 = JSON.parse(lines[0]!);
		const parsed1 = JSON.parse(lines[1]!);
		expect(parsed0.type).toBe('render');
		expect(parsed1.type).toBe('error');
		expect(parsed1.message).toBe('oops');
	});

	it('escapes special characters in content', () => {
		const root = createNode('ink-root');
		const text = createNode('ink-text');
		appendChild(text, createTextNode('line1\nline2\t"quotes"\u2603'));
		appendChild(root, text);
		root.yogaNode!.setWidth(80);
		root.yogaNode!.calculateLayout(
			undefined,
			undefined,
			Yoga.DIRECTION_LTR,
		);
		const msg = serializeTree(root);
		const encoded = encodeMessage(msg);

		const newlineCount = (encoded.match(/\n/g) ?? []).length;
		expect(newlineCount).toBe(1);

		const parsed = JSON.parse(encoded.trimEnd()) as RenderMessage;
		expect(parsed.type).toBe('render');
	});

	it('handles empty children array', () => {
		const root = createNode('ink-root');
		root.yogaNode!.setWidth(40);
		root.yogaNode!.calculateLayout(
			undefined,
			undefined,
			Yoga.DIRECTION_LTR,
		);
		const msg = serializeTree(root);
		const encoded = encodeMessage(msg);

		const parsed = JSON.parse(encoded.trimEnd());
		expect(parsed.root.children).toEqual([]);
	});

	it('encodes an error message', () => {
		const error: ErrorMessage = {
			type: 'error',
			message: 'boom',
			code: 'SERIALIZE_FAILED',
		};
		const encoded = encodeMessage(error);
		const parsed = JSON.parse(encoded.trimEnd());
		expect(parsed).toEqual(error);
	});
});

describe('Error message utilities', () => {
	it('creates basic error without code', () => {
		const err = createErrorMessage('something broke');
		expect(err).toEqual({type: 'error', message: 'something broke'});
		expect('code' in err).toBe(false);
	});

	it('creates error with code', () => {
		const err = createErrorMessage('bad tree', 'INVALID_TREE');
		expect(err).toEqual({
			type: 'error',
			message: 'bad tree',
			code: 'INVALID_TREE',
		});
	});

	it('defines ErrorCodes constants', () => {
		expect(ErrorCodes.SERIALIZE_FAILED).toBe('SERIALIZE_FAILED');
		expect(ErrorCodes.INVALID_TREE).toBe('INVALID_TREE');
		expect(ErrorCodes.YOGA_ERROR).toBe('YOGA_ERROR');
	});
});

describe('Full pipeline integration', () => {
	it('round-trips DOM → Yoga → serialize → NDJSON → parse', () => {
		const root = createNode('ink-root');

		const box = createNode('ink-box');
		box.style = {padding: 1, borderStyle: 'single' as const};
		applyStyles(box.yogaNode!, box.style, box.style);

		const text = createNode('ink-text');
		appendChild(text, createTextNode('pipeline'));
		appendChild(box, text);
		appendChild(root, box);

		root.yogaNode!.setWidth(40);
		root.yogaNode!.calculateLayout(
			undefined,
			undefined,
			Yoga.DIRECTION_LTR,
		);

		const msg = serializeTree(root);
		expect(msg.type).toBe('render');

		const encoded = encodeMessage(msg);
		expect(encoded.endsWith('\n')).toBe(true);

		const parsed = JSON.parse(encoded.trimEnd()) as RenderMessage;
		expect(parsed.type).toBe('render');
		expect(parsed.root.kind).toBe('box');

		const rootBox = parsed.root as any;
		expect(rootBox.children).toHaveLength(1);

		const child = rootBox.children[0];
		expect(child.kind).toBe('box');
		expect(child.border.style).toBe('single');
		expect(child.padding.top).toBe(1);

		const textChild = child.children[0];
		expect(textChild.kind).toBe('text');
		expect(textChild.content).toBe('pipeline');
	});
});
