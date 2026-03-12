import {describe, it, expect} from 'vitest';
import Yoga from 'yoga-layout';
import {createNode, createTextNode, appendChild} from '../../src/dom/dom.js';
import type {DOMElement} from '../../src/dom/types.js';
import applyStyles from '../../src/layout/styles.js';
import {serializeTree} from '../../src/protocol/serialize.js';
import type {
	BoxNode,
	TextNode as ProtocolTextNode,
	RenderMessage,
	WidgetNode,
} from '../../src/protocol/types.js';

function buildTree(
	setup: (root: DOMElement) => void,
	width = 80,
): RenderMessage {
	const root = createNode('ink-root');
	setup(root);
	root.yogaNode!.setWidth(width);
	root.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
	return serializeTree(root);
}

describe('serializeTree', () => {
	it('serializes empty root', () => {
		const result = buildTree(() => {});
		expect(result.type).toBe('render');
		const root = result.root as BoxNode;
		expect(root.kind).toBe('box');
		expect(root.layout).toEqual({x: 0, y: 0, width: 80, height: 0});
		expect(root.children).toEqual([]);
	});

	it('serializes single text node', () => {
		const result = buildTree(root => {
			const text = createNode('ink-text');
			appendChild(text, createTextNode('Hello'));
			appendChild(root, text);
		});

		const rootBox = result.root as BoxNode;
		expect(rootBox.children).toHaveLength(1);

		const textNode = rootBox.children[0] as ProtocolTextNode;
		expect(textNode.kind).toBe('text');
		expect(textNode.content).toBe('Hello');
		expect(textNode.layout.x).toBe(0);
		expect(textNode.layout.y).toBe(0);
	});

	it('serializes nested boxes', () => {
		const result = buildTree(root => {
			const outer = createNode('ink-box');
			const inner = createNode('ink-box');
			const text = createNode('ink-text');
			appendChild(text, createTextNode('deep'));
			appendChild(inner, text);
			appendChild(outer, inner);
			appendChild(root, outer);
		});

		const rootBox = result.root as BoxNode;
		expect(rootBox.children).toHaveLength(1);
		const outer = rootBox.children[0] as BoxNode;
		expect(outer.kind).toBe('box');
		expect(outer.children).toHaveLength(1);
		const inner = outer.children[0] as BoxNode;
		expect(inner.kind).toBe('box');
		expect(inner.children).toHaveLength(1);
		const textNode = inner.children[0] as ProtocolTextNode;
		expect(textNode.kind).toBe('text');
		expect(textNode.content).toBe('deep');
	});

	it('accumulates absolute coordinates through padding', () => {
		const result = buildTree(root => {
			const box = createNode('ink-box');
			box.style = {padding: 2};
			applyStyles(box.yogaNode!, {padding: 2});

			const text = createNode('ink-text');
			appendChild(text, createTextNode('test'));
			appendChild(box, text);
			appendChild(root, box);
		});

		const rootBox = result.root as BoxNode;
		const box = rootBox.children[0] as BoxNode;
		const textNode = box.children[0] as ProtocolTextNode;
		expect(textNode.layout.x).toBe(2);
		expect(textNode.layout.y).toBe(2);
	});

	it('serializes box with border', () => {
		const result = buildTree(root => {
			const box = createNode('ink-box');
			const style = {borderStyle: 'single' as const};
			box.style = style;
			applyStyles(box.yogaNode!, style, style);
			appendChild(root, box);
		});

		const rootBox = result.root as BoxNode;
		const box = rootBox.children[0] as BoxNode;
		expect(box.border.top).toBe(1);
		expect(box.border.right).toBe(1);
		expect(box.border.bottom).toBe(1);
		expect(box.border.left).toBe(1);
		expect(box.border.style).toBe('single');
		expect(box.border.color).toBeNull();
	});

	it('serializes box with per-side border disable', () => {
		const result = buildTree(root => {
			const box = createNode('ink-box');
			const style = {borderStyle: 'single' as const, borderTop: false};
			box.style = style;
			applyStyles(box.yogaNode!, style, style);
			appendChild(root, box);
		});

		const rootBox = result.root as BoxNode;
		const box = rootBox.children[0] as BoxNode;
		expect(box.border.top).toBe(0);
		expect(box.border.right).toBe(1);
		expect(box.border.bottom).toBe(1);
		expect(box.border.left).toBe(1);
	});

	it('serializes box with border colors', () => {
		const result = buildTree(root => {
			const box = createNode('ink-box');
			const style = {
				borderStyle: 'single' as const,
				borderColor: 'red',
				borderTopColor: 'blue',
			};
			box.style = style;
			applyStyles(box.yogaNode!, style, style);
			appendChild(root, box);
		});

		const rootBox = result.root as BoxNode;
		const box = rootBox.children[0] as BoxNode;
		expect(box.border.style).toBe('single');
		expect(box.border.color).toBe('red');
		expect(box.border.topColor).toBe('blue');
	});

	it('serializes box with padding', () => {
		const result = buildTree(root => {
			const box = createNode('ink-box');
			box.style = {padding: 1};
			applyStyles(box.yogaNode!, {padding: 1});
			appendChild(root, box);
		});

		const rootBox = result.root as BoxNode;
		const box = rootBox.children[0] as BoxNode;
		expect(box.padding).toEqual({top: 1, right: 1, bottom: 1, left: 1});
	});

	it('serializes box with background', () => {
		const result = buildTree(root => {
			const box = createNode('ink-box');
			box.style = {backgroundColor: '#ff0000'};
			appendChild(root, box);
		});

		const rootBox = result.root as BoxNode;
		const box = rootBox.children[0] as BoxNode;
		expect(box.background).toBe('#ff0000');
	});

	it('serializes box with overflow hidden', () => {
		const result = buildTree(root => {
			const box1 = createNode('ink-box');
			box1.style = {overflow: 'hidden'};
			appendChild(root, box1);

			const box2 = createNode('ink-box');
			box2.style = {overflowX: 'hidden'};
			appendChild(root, box2);
		});

		const rootBox = result.root as BoxNode;
		expect((rootBox.children[0] as BoxNode).overflow).toBe('hidden');
		expect((rootBox.children[1] as BoxNode).overflow).toBe('hidden');
	});

	it('serializes text with styled content via internal_transform', () => {
		const result = buildTree(root => {
			const text = createNode('ink-text');
			const vtext = createNode('ink-virtual-text');
			vtext.internal_transform = s => `[${s}]`;
			appendChild(vtext, createTextNode('hello'));
			appendChild(text, vtext);
			appendChild(root, text);
		});

		const rootBox = result.root as BoxNode;
		const textNode = rootBox.children[0] as ProtocolTextNode;
		expect(textNode.content).toBe('[hello]');
	});

	it('serializes text with nested virtual-text', () => {
		const result = buildTree(root => {
			const text = createNode('ink-text');
			const vtext = createNode('ink-virtual-text');
			appendChild(vtext, createTextNode('inner'));
			appendChild(text, vtext);
			appendChild(root, text);
		});

		const rootBox = result.root as BoxNode;
		expect(rootBox.children).toHaveLength(1);
		const textNode = rootBox.children[0] as ProtocolTextNode;
		expect(textNode.kind).toBe('text');
		expect(textNode.content).toBe('inner');
	});

	it('serializes text wrap mode', () => {
		const result = buildTree(root => {
			const text = createNode('ink-text');
			text.style = {textWrap: 'truncate-end'};
			appendChild(text, createTextNode('some text'));
			appendChild(root, text);
		});

		const rootBox = result.root as BoxNode;
		const textNode = rootBox.children[0] as ProtocolTextNode;
		expect(textNode.wrap).toBe('truncate-end');
	});

	it('excludes display:none nodes', () => {
		const result = buildTree(root => {
			const visible = createNode('ink-box');
			appendChild(root, visible);

			const hidden = createNode('ink-box');
			hidden.style = {display: 'none'};
			applyStyles(hidden.yogaNode!, {display: 'none'});
			appendChild(root, hidden);
		});

		const rootBox = result.root as BoxNode;
		expect(rootBox.children).toHaveLength(1);
	});

	it('preserves multiple children ordering', () => {
		const result = buildTree(root => {
			for (const label of ['A', 'B', 'C']) {
				const text = createNode('ink-text');
				appendChild(text, createTextNode(label));
				appendChild(root, text);
			}
		});

		const rootBox = result.root as BoxNode;
		expect(rootBox.children).toHaveLength(3);
		expect((rootBox.children[0] as ProtocolTextNode).content).toBe('A');
		expect((rootBox.children[1] as ProtocolTextNode).content).toBe('B');
		expect((rootBox.children[2] as ProtocolTextNode).content).toBe('C');
	});

	it('produces integer layout values', () => {
		const result = buildTree(root => {
			applyStyles(root.yogaNode!, {flexDirection: 'row'});
			for (let i = 0; i < 3; i++) {
				const box = createNode('ink-box');
				applyStyles(box.yogaNode!, {flexGrow: 1, height: 1});
				appendChild(root, box);
			}
		}, 10);

		function checkIntegers(node: WidgetNode) {
			expect(Number.isInteger(node.layout.x)).toBe(true);
			expect(Number.isInteger(node.layout.y)).toBe(true);
			expect(Number.isInteger(node.layout.width)).toBe(true);
			expect(Number.isInteger(node.layout.height)).toBe(true);
			if (node.kind === 'box') {
				for (const child of node.children) {
					checkIntegers(child);
				}
			}
		}

		checkIntegers(result.root);
	});
});
