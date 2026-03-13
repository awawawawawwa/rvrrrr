// @vitest-environment node
import {describe, it, expect} from 'vitest';
import {measureElement} from '../measure-element.js';
import type {DOMElement} from '../../dom/types.js';

describe('measureElement', () => {
	it('returns { width: 0, height: 0 } if ref.current is null', () => {
		const ref = {current: null};
		expect(measureElement(ref as any)).toEqual({width: 0, height: 0});
	});

	it('returns { width: 0, height: 0 } if no yogaNode', () => {
		const fakeElement: Partial<DOMElement> = {
			nodeName: 'ink-box',
			yogaNode: undefined,
		};
		const ref = {current: fakeElement as DOMElement};
		expect(measureElement(ref)).toEqual({width: 0, height: 0});
	});

	it('returns computed dimensions from yogaNode', () => {
		const fakeYogaNode = {
			getComputedWidth: () => 42,
			getComputedHeight: () => 10,
		};
		const fakeElement: Partial<DOMElement> = {
			nodeName: 'ink-box',
			yogaNode: fakeYogaNode as any,
		};
		const ref = {current: fakeElement as DOMElement};
		expect(measureElement(ref)).toEqual({width: 42, height: 10});
	});

	it('returns { width: 0, height: 0 } for zero dimensions', () => {
		const fakeYogaNode = {
			getComputedWidth: () => 0,
			getComputedHeight: () => 0,
		};
		const fakeElement: Partial<DOMElement> = {
			nodeName: 'ink-box',
			yogaNode: fakeYogaNode as any,
		};
		const ref = {current: fakeElement as DOMElement};
		expect(measureElement(ref)).toEqual({width: 0, height: 0});
	});
});
