import {describe, it, expect} from 'vitest';
import React, {act} from 'react';
import Yoga from 'yoga-layout';
import {reconciler} from '../../src/reconciler/index.js';
import {createNode} from '../../src/dom/dom.js';
import type {DOMElement} from '../../src/dom/types.js';
import Box from '../../src/components/Box.js';

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

describe('Box component', () => {
	it('renders as ink-box with a YogaNode', () => {
		const root = createTestRoot();
		renderToRoot(root, <Box />);

		const box = root.childNodes[0] as DOMElement;
		expect(box.nodeName).toBe('ink-box');
		expect(box.yogaNode).toBeDefined();
	});

	it('passes layout props to Yoga', () => {
		const root = createTestRoot();
		renderToRoot(root, <Box flexDirection="row" padding={2} />);

		const box = root.childNodes[0] as DOMElement;
		expect(box.yogaNode).toBeDefined();
		expect(box.yogaNode!.getComputedPadding(Yoga.EDGE_TOP)).toBe(2);
		expect(box.yogaNode!.getComputedPadding(Yoga.EDGE_LEFT)).toBe(2);
		expect(box.yogaNode!.getComputedPadding(Yoga.EDGE_RIGHT)).toBe(2);
		expect(box.yogaNode!.getComputedPadding(Yoga.EDGE_BOTTOM)).toBe(2);
	});

	it('applies borderStyle to style and Yoga computes border widths', () => {
		const root = createTestRoot();
		renderToRoot(root, <Box borderStyle="single" />);

		const box = root.childNodes[0] as DOMElement;
		expect(box.style.borderStyle).toBe('single');
		expect(box.yogaNode!.getComputedBorder(Yoga.EDGE_TOP)).toBe(1);
		expect(box.yogaNode!.getComputedBorder(Yoga.EDGE_BOTTOM)).toBe(1);
		expect(box.yogaNode!.getComputedBorder(Yoga.EDGE_LEFT)).toBe(1);
		expect(box.yogaNode!.getComputedBorder(Yoga.EDGE_RIGHT)).toBe(1);
	});

	it('disables top border with borderTop={false}', () => {
		const root = createTestRoot();
		renderToRoot(root, <Box borderStyle="single" borderTop={false} />);

		const box = root.childNodes[0] as DOMElement;
		expect(box.yogaNode!.getComputedBorder(Yoga.EDGE_TOP)).toBe(0);
		expect(box.yogaNode!.getComputedBorder(Yoga.EDGE_BOTTOM)).toBe(1);
	});

	it('stores borderColor in style', () => {
		const root = createTestRoot();
		renderToRoot(root, <Box borderStyle="single" borderColor="red" />);

		const box = root.childNodes[0] as DOMElement;
		expect(box.style.borderColor).toBe('red');
	});

	it('handles nested boxes with different flex directions', () => {
		const root = createTestRoot();
		renderToRoot(
			root,
			<Box flexDirection="row" width={40} height={10}>
				<Box width={20} height={10} />
				<Box width={20} height={10} />
			</Box>,
		);

		const outer = root.childNodes[0] as DOMElement;
		const first = outer.childNodes[0] as DOMElement;
		const second = outer.childNodes[1] as DOMElement;

		expect(first.yogaNode!.getComputedLeft()).toBe(0);
		expect(second.yogaNode!.getComputedLeft()).toBe(20);
	});

	it.each([
		'single',
		'double',
		'round',
		'bold',
		'singleDouble',
		'classic',
	] as const)('accepts borderStyle="%s" without error', (style) => {
		const root = createTestRoot();
		expect(() => {
			renderToRoot(root, <Box borderStyle={style} />);
		}).not.toThrow();
	});

	it('accepts a custom BoxStyle object as borderStyle', () => {
		const root = createTestRoot();
		const custom = {
			topLeft: '+',
			top: '-',
			topRight: '+',
			right: '|',
			bottomRight: '+',
			bottom: '-',
			bottomLeft: '+',
			left: '|',
		};
		renderToRoot(root, <Box borderStyle={custom} />);

		const box = root.childNodes[0] as DOMElement;
		expect(box.style.borderStyle).toEqual(custom);
		expect(box.yogaNode!.getComputedBorder(Yoga.EDGE_TOP)).toBe(1);
	});
});
