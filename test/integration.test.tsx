import {describe, it, expect} from 'vitest';
import React from 'react';
import Yoga from 'yoga-layout';
import {reconciler} from '../src/reconciler/index.js';
import {createNode} from '../src/dom/dom.js';
import type {DOMElement} from '../src/dom/types.js';

describe('Integration: Reconciler + Yoga Layout', () => {
	it('renders JSX and computes correct layout coordinates', () => {
		const root = createNode('ink-root');
		root.yogaNode!.setWidth(80);
		root.yogaNode!.setHeight(24);

		let layoutComputed = false;
		root.onComputeLayout = () => {
			root.yogaNode!.calculateLayout(
				undefined,
				undefined,
				Yoga.DIRECTION_LTR,
			);
			layoutComputed = true;
		};
		root.onRender = () => {};

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

		reconciler.updateContainer(
			React.createElement(
				'ink-box',
				{
					style: {flexDirection: 'row', padding: 1},
				},
				React.createElement('ink-text', null, 'Hello'),
				React.createElement('ink-text', null, 'World'),
			),
			container,
			null,
			() => {},
		);

		expect(layoutComputed).toBe(true);

		const box = root.childNodes[0] as DOMElement;
		expect(box.nodeName).toBe('ink-box');
		expect(box.yogaNode!.getComputedWidth()).toBe(80);

		const text1 = box.childNodes[0] as DOMElement;
		const text2 = box.childNodes[1] as DOMElement;

		expect(text1.yogaNode!.getComputedLeft()).toBeGreaterThanOrEqual(1);
		expect(text1.yogaNode!.getComputedTop()).toBeGreaterThanOrEqual(1);
		expect(text2.yogaNode!.getComputedLeft()).toBeGreaterThan(
			text1.yogaNode!.getComputedLeft(),
		);
	});

	it('handles nested box layout', () => {
		const root = createNode('ink-root');
		root.yogaNode!.setWidth(80);
		root.yogaNode!.setHeight(24);

		root.onComputeLayout = () => {
			root.yogaNode!.calculateLayout(
				undefined,
				undefined,
				Yoga.DIRECTION_LTR,
			);
		};
		root.onRender = () => {};

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

		reconciler.updateContainer(
			React.createElement(
				'ink-box',
				{
					style: {flexDirection: 'column', width: 40},
				},
				React.createElement('ink-box', {
					style: {height: 3},
				}),
				React.createElement('ink-box', {
					style: {height: 5},
				}),
			),
			container,
			null,
			() => {},
		);

		const outerBox = root.childNodes[0] as DOMElement;
		const topBox = outerBox.childNodes[0] as DOMElement;
		const bottomBox = outerBox.childNodes[1] as DOMElement;

		expect(outerBox.yogaNode!.getComputedWidth()).toBe(40);
		expect(topBox.yogaNode!.getComputedTop()).toBe(0);
		expect(topBox.yogaNode!.getComputedHeight()).toBe(3);
		expect(bottomBox.yogaNode!.getComputedTop()).toBe(3);
		expect(bottomBox.yogaNode!.getComputedHeight()).toBe(5);
	});
});
