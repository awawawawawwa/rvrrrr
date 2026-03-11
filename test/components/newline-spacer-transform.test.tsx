import {describe, it, expect} from 'vitest';
import React, {act} from 'react';
import Yoga from 'yoga-layout';
import {reconciler} from '../../src/reconciler/index.js';
import {createNode} from '../../src/dom/dom.js';
import squashTextNodes from '../../src/layout/squash-text-nodes.js';
import type {DOMElement, TextNode} from '../../src/dom/types.js';
import Newline from '../../src/components/Newline.js';
import Spacer from '../../src/components/Spacer.js';
import Transform from '../../src/components/Transform.js';

function createTestRoot(): DOMElement {
	const root = createNode('ink-root');
	root.yogaNode!.setWidth(80);
	root.yogaNode!.setHeight(24);

	root.onComputeLayout = () => {
		root.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
	};
	root.onRender = () => {};

	return root;
}

function renderToRoot(root: DOMElement, element: React.ReactElement) {
	const container = reconciler.createContainer(
		root,
		0,
		null,
		false,
		null,
		'',
		() => {},
		() => {},
		() => {},
		null,
	);
	act(() => {
		reconciler.updateContainer(element, container, null, () => {});
	});
	return container;
}

describe('Newline', () => {
	it('renders a single newline by default', () => {
		const root = createTestRoot();
		renderToRoot(root, React.createElement(Newline));

		const textNode = root.childNodes[0] as DOMElement;
		expect(textNode.nodeName).toBe('ink-text');
		expect(textNode.childNodes.length).toBe(1);
		expect((textNode.childNodes[0] as TextNode).nodeValue).toBe('\n');
	});

	it('renders multiple newlines with count prop', () => {
		const root = createTestRoot();
		renderToRoot(root, React.createElement(Newline, {count: 3}));

		const textNode = root.childNodes[0] as DOMElement;
		expect((textNode.childNodes[0] as TextNode).nodeValue).toBe('\n\n\n');
	});

	it('positions content below with a gap when used in column layout', () => {
		const root = createTestRoot();
		renderToRoot(
			root,
			React.createElement(
				'ink-box',
				{style: {flexDirection: 'column'}},
				React.createElement('ink-text', null, 'A'),
				React.createElement(Newline),
				React.createElement('ink-text', null, 'B'),
			),
		);

		const box = root.childNodes[0] as DOMElement;
		const textA = box.childNodes[0] as DOMElement;
		const newline = box.childNodes[1] as DOMElement;
		const textB = box.childNodes[2] as DOMElement;

		const topA = textA.yogaNode!.getComputedTop();
		const topNewline = newline.yogaNode!.getComputedTop();
		const topB = textB.yogaNode!.getComputedTop();

		expect(topNewline).toBeGreaterThan(topA);
		expect(topB).toBeGreaterThan(topNewline);
	});
});

describe('Spacer', () => {
	it('renders as ink-box with flexGrow and flexShrink', () => {
		const root = createTestRoot();
		renderToRoot(root, React.createElement(Spacer));

		const spacerNode = root.childNodes[0] as DOMElement;
		expect(spacerNode.nodeName).toBe('ink-box');
		expect(spacerNode.style.flexGrow).toBe(1);
		expect(spacerNode.style.flexShrink).toBe(0);
	});

	it('pushes siblings apart in a row layout', () => {
		const root = createTestRoot();
		renderToRoot(
			root,
			React.createElement(
				'ink-box',
				{style: {flexDirection: 'row', width: 80}},
				React.createElement('ink-text', null, 'Left'),
				React.createElement(Spacer),
				React.createElement('ink-text', null, 'Right'),
			),
		);

		const box = root.childNodes[0] as DOMElement;
		const leftText = box.childNodes[0] as DOMElement;
		const spacer = box.childNodes[1] as DOMElement;
		const rightText = box.childNodes[2] as DOMElement;

		const leftEnd =
			leftText.yogaNode!.getComputedLeft() +
			leftText.yogaNode!.getComputedWidth();
		const rightStart = rightText.yogaNode!.getComputedLeft();

		expect(spacer.yogaNode!.getComputedWidth()).toBeGreaterThan(0);
		expect(rightStart).toBeGreaterThan(leftEnd);
	});

	it('divides space equally with multiple spacers', () => {
		const root = createTestRoot();
		renderToRoot(
			root,
			React.createElement(
				'ink-box',
				{style: {flexDirection: 'row', width: 80}},
				React.createElement(Spacer),
				React.createElement('ink-text', null, 'Mid'),
				React.createElement(Spacer),
			),
		);

		const box = root.childNodes[0] as DOMElement;
		const spacer1 = box.childNodes[0] as DOMElement;
		const spacer2 = box.childNodes[2] as DOMElement;

		const w1 = spacer1.yogaNode!.getComputedWidth();
		const w2 = spacer2.yogaNode!.getComputedWidth();

		expect(w1).toBeGreaterThan(0);
		expect(w1).toBe(w2);
	});
});

describe('Transform', () => {
	it('renders as ink-virtual-text', () => {
		const root = createTestRoot();
		renderToRoot(
			root,
			React.createElement(
				'ink-text',
				null,
				React.createElement(
					Transform,
					{transform: (s: string) => s},
					'hello',
				),
			),
		);

		const textNode = root.childNodes[0] as DOMElement;
		const virtualText = textNode.childNodes[0] as DOMElement;
		expect(virtualText.nodeName).toBe('ink-virtual-text');
	});

	it('transform function is called by squashTextNodes', () => {
		const root = createTestRoot();
		renderToRoot(
			root,
			React.createElement(
				'ink-text',
				null,
				React.createElement(
					Transform,
					{transform: (s: string) => s.toUpperCase()},
					'hello',
				),
			),
		);

		const textNode = root.childNodes[0] as DOMElement;
		const result = squashTextNodes(textNode);
		expect(result).toBe('HELLO');
	});

	it('passes index to the transform function', () => {
		const root = createTestRoot();
		const indices: number[] = [];

		renderToRoot(
			root,
			React.createElement(
				'ink-text',
				null,
				'prefix',
				React.createElement(
					Transform,
					{
						transform: (_s: string, index: number) => {
							indices.push(index);
							return _s;
						},
					},
					'content',
				),
			),
		);

		const textNode = root.childNodes[0] as DOMElement;
		squashTextNodes(textNode);
		expect(indices.length).toBeGreaterThan(0);
		expect(typeof indices[0]).toBe('number');
	});

	it('nested transforms compose correctly', () => {
		const root = createTestRoot();
		renderToRoot(
			root,
			React.createElement(
				'ink-text',
				null,
				React.createElement(
					Transform,
					{transform: (s: string) => s.toUpperCase()},
					React.createElement(
						Transform,
						{transform: (s: string) => `[${s}]`},
						'hi',
					),
				),
			),
		);

		const textNode = root.childNodes[0] as DOMElement;
		const result = squashTextNodes(textNode);
		expect(result).toBe('[HI]');
	});
});
