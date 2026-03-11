import {describe, it, expect} from 'vitest';
import React, {act} from 'react';
import Yoga from 'yoga-layout';
import ansiStyles from 'ansi-styles';
import {reconciler} from '../../src/reconciler/index.js';
import {createNode} from '../../src/dom/dom.js';
import type {DOMElement} from '../../src/dom/types.js';
import squashTextNodes from '../../src/layout/squash-text-nodes.js';
import Text from '../../src/components/Text.js';

function getTextOutput(node: DOMElement): string {
	let output = squashTextNodes(node);
	if (node.internal_transform) {
		output = node.internal_transform(output, 0);
	}

	return output;
}

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

describe('Text component', () => {
	it('renders as ink-text at top level with a YogaNode', () => {
		const root = createTestRoot();
		renderToRoot(root, <Text>hello</Text>);

		const text = root.childNodes[0] as DOMElement;
		expect(text.nodeName).toBe('ink-text');
		expect(text.yogaNode).toBeDefined();
	});

	it('renders as ink-virtual-text when nested inside another Text', () => {
		const root = createTestRoot();
		renderToRoot(
			root,
			<Text>
				outer
				<Text>inner</Text>
			</Text>,
		);

		const outerText = root.childNodes[0] as DOMElement;
		expect(outerText.nodeName).toBe('ink-text');

		const virtualTexts = outerText.childNodes.filter(
			(c) => 'nodeName' in c && c.nodeName === 'ink-virtual-text',
		) as DOMElement[];
		expect(virtualTexts.length).toBeGreaterThan(0);

		const inner = virtualTexts[0]!;
		expect(inner.nodeName).toBe('ink-virtual-text');
		expect(inner.yogaNode).toBeUndefined();
	});

	it('applies bold transform', () => {
		const root = createTestRoot();
		renderToRoot(root, <Text bold>hello</Text>);

		const text = root.childNodes[0] as DOMElement;
		const output = getTextOutput(text);
		expect(output).toContain(ansiStyles.bold.open);
		expect(output).toContain(ansiStyles.bold.close);
		expect(output).toContain('hello');
	});

	it('applies color transform', () => {
		const root = createTestRoot();
		renderToRoot(root, <Text color="red">hello</Text>);

		const text = root.childNodes[0] as DOMElement;
		const output = getTextOutput(text);
		expect(output).toContain(ansiStyles.red.open);
		expect(output).toContain('hello');
	});

	it('applies multiple styles', () => {
		const root = createTestRoot();
		renderToRoot(
			root,
			<Text bold italic color="red">
				hello
			</Text>,
		);

		const text = root.childNodes[0] as DOMElement;
		const output = getTextOutput(text);
		expect(output).toContain(ansiStyles.bold.open);
		expect(output).toContain(ansiStyles.italic.open);
		expect(output).toContain(ansiStyles.red.open);
		expect(output).toContain('hello');
	});

	it('defaults textWrap to wrap', () => {
		const root = createTestRoot();
		renderToRoot(root, <Text>hello</Text>);

		const text = root.childNodes[0] as DOMElement;
		expect(text.style.textWrap).toBe('wrap');
	});

	it.each([
		['wrap', 'wrap'],
		['truncate', 'truncate-end'],
		['truncate-start', 'truncate-start'],
		['truncate-middle', 'truncate-middle'],
		['truncate-end', 'truncate-end'],
	] as const)('maps wrap="%s" to textWrap="%s"', (wrapValue, expected) => {
		const root = createTestRoot();
		renderToRoot(root, <Text wrap={wrapValue}>hello</Text>);

		const text = root.childNodes[0] as DOMElement;
		expect(text.style.textWrap).toBe(expected);
	});

	it('applies dimColor', () => {
		const root = createTestRoot();
		renderToRoot(root, <Text dimColor>hello</Text>);

		const text = root.childNodes[0] as DOMElement;
		const output = getTextOutput(text);
		expect(output).toContain(ansiStyles.dim.open);
		expect(output).toContain(ansiStyles.dim.close);
		expect(output).toContain('hello');
	});

	it('composes nested Text transforms', () => {
		const root = createTestRoot();
		renderToRoot(
			root,
			<Text bold>
				<Text color="red">hi</Text>
			</Text>,
		);

		const outerText = root.childNodes[0] as DOMElement;
		const output = getTextOutput(outerText);
		expect(output).toContain(ansiStyles.bold.open);
		expect(output).toContain(ansiStyles.red.open);
		expect(output).toContain('hi');
	});
});
