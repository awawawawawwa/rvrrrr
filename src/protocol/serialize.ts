import Yoga from 'yoga-layout';
import {type DOMElement} from '../dom/types.js';
import squashTextNodes from '../layout/squash-text-nodes.js';
import wrapText from '../layout/wrap-text.js';
import type {
	BoxNode,
	TextNode as ProtocolTextNode,
	WidgetNode,
	RenderMessage,
	BoxStyleWire,
} from './types.js';

const serializeBoxNode = (
	node: DOMElement,
	x: number,
	y: number,
	width: number,
	height: number,
): BoxNode => {
	const yoga = node.yogaNode!;

	const padding = {
		top: Math.round(yoga.getComputedPadding(Yoga.EDGE_TOP)),
		right: Math.round(yoga.getComputedPadding(Yoga.EDGE_RIGHT)),
		bottom: Math.round(yoga.getComputedPadding(Yoga.EDGE_BOTTOM)),
		left: Math.round(yoga.getComputedPadding(Yoga.EDGE_LEFT)),
	};

	const borderTop = Math.round(yoga.getComputedBorder(Yoga.EDGE_TOP));
	const borderRight = Math.round(yoga.getComputedBorder(Yoga.EDGE_RIGHT));
	const borderBottom = Math.round(yoga.getComputedBorder(Yoga.EDGE_BOTTOM));
	const borderLeft = Math.round(yoga.getComputedBorder(Yoga.EDGE_LEFT));

	let borderStyle: string | BoxStyleWire | null = null;
	if (node.style.borderStyle) {
		if (typeof node.style.borderStyle === 'string') {
			borderStyle = node.style.borderStyle;
		} else {
			borderStyle = {
				topLeft: node.style.borderStyle.topLeft,
				top: node.style.borderStyle.top,
				topRight: node.style.borderStyle.topRight,
				right: node.style.borderStyle.right,
				bottomRight: node.style.borderStyle.bottomRight,
				bottom: node.style.borderStyle.bottom,
				bottomLeft: node.style.borderStyle.bottomLeft,
				left: node.style.borderStyle.left,
			};
		}
	}

	const overflow: 'visible' | 'hidden' =
		node.style.overflow === 'hidden' ||
		node.style.overflowX === 'hidden' ||
		node.style.overflowY === 'hidden'
			? 'hidden'
			: 'visible';

	const children: WidgetNode[] = [];
	for (const child of node.childNodes) {
		if (child.nodeName === '#text') {
			continue;
		}

		const serialized = serializeNode(child, x, y);
		if (serialized) {
			children.push(serialized);
		}
	}

	return {
		kind: 'box',
		layout: {
			x: Math.round(x),
			y: Math.round(y),
			width: Math.round(width),
			height: Math.round(height),
		},
		padding,
		border: {
			top: borderTop,
			right: borderRight,
			bottom: borderBottom,
			left: borderLeft,
			style: borderStyle,
			color: node.style.borderColor ?? null,
			topColor: node.style.borderTopColor ?? null,
			rightColor: node.style.borderRightColor ?? null,
			bottomColor: node.style.borderBottomColor ?? null,
			leftColor: node.style.borderLeftColor ?? null,
			dimColor: node.style.borderDimColor ?? false,
			topDimColor: node.style.borderTopDimColor ?? false,
			rightDimColor: node.style.borderRightDimColor ?? false,
			bottomDimColor: node.style.borderBottomDimColor ?? false,
			leftDimColor: node.style.borderLeftDimColor ?? false,
		},
		background: node.style.backgroundColor ?? null,
		overflow,
		children,
	};
};

const serializeTextNode = (
	node: DOMElement,
	x: number,
	y: number,
	width: number,
	height: number,
): ProtocolTextNode => {
	const content = squashTextNodes(node);
	const wrap = node.style.textWrap ?? 'wrap';
	const wrappedContent = wrapText(content, Math.round(width), wrap);

	return {
		kind: 'text',
		layout: {
			x: Math.round(x),
			y: Math.round(y),
			width: Math.round(width),
			height: Math.round(height),
		},
		content: wrappedContent,
		wrap,
	};
};

const serializeNode = (
	node: DOMElement,
	parentX: number,
	parentY: number,
): WidgetNode | null => {
	if (!node.yogaNode) {
		return null;
	}

	if (node.yogaNode.getDisplay() === Yoga.DISPLAY_NONE) {
		return null;
	}

	const left = node.yogaNode.getComputedLeft();
	const top = node.yogaNode.getComputedTop();
	const width = node.yogaNode.getComputedWidth();
	const height = node.yogaNode.getComputedHeight();

	const absX = parentX + left;
	const absY = parentY + top;

	switch (node.nodeName) {
		case 'ink-root':
		case 'ink-box':
			return serializeBoxNode(node, absX, absY, width, height);
		case 'ink-text':
			return serializeTextNode(node, absX, absY, width, height);
		default:
			return null;
	}
};

export const serializeTree = (rootNode: DOMElement): RenderMessage => {
	const root = serializeNode(rootNode, 0, 0);
	return {
		type: 'render',
		root: root!,
	};
};
