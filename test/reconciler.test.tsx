import {describe, it, expect} from 'vitest';
import React from 'react';
import Yoga from 'yoga-layout';
import {reconciler} from '../src/reconciler/index.js';
import {createNode} from '../src/dom/dom.js';
import type {DOMElement} from '../src/dom/types.js';

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
	reconciler.updateContainer(element, container, null, () => {});
	return container;
}

describe('Reconciler + DOM', () => {
	it('creates correct node tree from JSX', () => {
		const root = createTestRoot();
		renderToRoot(
			root,
			React.createElement(
				'ink-box',
				null,
				React.createElement('ink-text', null, 'Hello'),
				React.createElement('ink-text', null, 'World'),
			),
		);

		expect(root.childNodes.length).toBe(1);
		const box = root.childNodes[0] as DOMElement;
		expect(box.nodeName).toBe('ink-box');
		expect(box.childNodes.length).toBe(2);
		expect((box.childNodes[0] as DOMElement).nodeName).toBe('ink-text');
		expect((box.childNodes[1] as DOMElement).nodeName).toBe('ink-text');
	});

	it('mirrors DOM tree in Yoga tree', () => {
		const root = createTestRoot();
		renderToRoot(
			root,
			React.createElement(
				'ink-box',
				null,
				React.createElement('ink-box', null),
				React.createElement('ink-box', null),
			),
		);

		const box = root.childNodes[0] as DOMElement;
		expect(box.yogaNode).toBeDefined();
		expect(box.yogaNode!.getChildCount()).toBe(2);
	});

	it('handles rerender with node removal', () => {
		const root = createTestRoot();
		const container = renderToRoot(
			root,
			React.createElement(
				'ink-box',
				null,
				React.createElement('ink-text', null, 'A'),
				React.createElement('ink-text', null, 'B'),
			),
		);

		reconciler.updateContainer(
			React.createElement(
				'ink-box',
				null,
				React.createElement('ink-text', null, 'A'),
			),
			container,
			null,
			() => {},
		);

		const box = root.childNodes[0] as DOMElement;
		expect(box.childNodes.length).toBe(1);
		expect(box.yogaNode!.getChildCount()).toBe(1);
	});

	it('commits text updates', () => {
		const root = createTestRoot();
		const container = renderToRoot(
			root,
			React.createElement('ink-text', null, 'Hello'),
		);

		reconciler.updateContainer(
			React.createElement('ink-text', null, 'World'),
			container,
			null,
			() => {},
		);

		const text = root.childNodes[0] as DOMElement;
		expect(text.childNodes.length).toBe(1);
		expect((text.childNodes[0] as any).nodeValue).toBe('World');
	});
});
