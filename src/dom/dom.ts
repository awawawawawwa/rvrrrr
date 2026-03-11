import Yoga, {type Node as YogaNode} from 'yoga-layout';
import measureText from '../layout/measure-text.js';
import {type Styles} from '../layout/styles.js';
import wrapText from '../layout/wrap-text.js';
import squashTextNodes from '../layout/squash-text-nodes.js';
import {
	type DOMElement,
	type TextNode,
	type DOMNode,
	type DOMNodeAttribute,
} from './types.js';

type LayoutListener = () => void;

export const createNode = (nodeName: string): DOMElement => {
	const node: DOMElement = {
		nodeName: nodeName as DOMElement['nodeName'],
		style: {},
		attributes: {},
		childNodes: [],
		parentNode: undefined,
		yogaNode:
			nodeName === 'ink-virtual-text' ? undefined : Yoga.Node.create(),
		internal_transform: undefined,
		internal_layoutListeners: undefined,
	};

	if (nodeName === 'ink-text') {
		node.yogaNode?.setMeasureFunc(measureTextNode.bind(null, node));
	}

	return node;
};

export const createTextNode = (text: string): TextNode => {
	const node: TextNode = {
		nodeName: '#text',
		nodeValue: text,
		yogaNode: undefined,
		parentNode: undefined,
		style: {},
	};

	setTextNodeValue(node, text);

	return node;
};

const measureTextNode = function (
	node: DOMNode,
	width: number,
): {width: number; height: number} {
	const text =
		node.nodeName === '#text' ? node.nodeValue : squashTextNodes(node);

	const dimensions = measureText(text);

	if (dimensions.width <= width) {
		return dimensions;
	}

	// Yoga is probing at sub-pixel widths during shrink — tell it "no"
	if (dimensions.width >= 1 && width > 0 && width < 1) {
		return dimensions;
	}

	const textWrap = node.style?.textWrap ?? 'wrap';
	const wrappedText = wrapText(text, width, textWrap);

	return measureText(wrappedText);
};

const findClosestYogaNode = (node?: DOMNode): YogaNode | undefined => {
	if (!node?.parentNode) {
		return undefined;
	}

	return node.yogaNode ?? findClosestYogaNode(node.parentNode);
};

const markNodeAsDirty = (node?: DOMNode): void => {
	const yogaNode = findClosestYogaNode(node);
	yogaNode?.markDirty();
};

function cleanupYogaNode(node?: YogaNode): void {
	node?.unsetMeasureFunc();
	node?.freeRecursive();
}

export const appendChild = (node: DOMElement, child: DOMNode): void => {
	if (child.parentNode) {
		removeChild(child.parentNode, child);
	}

	child.parentNode = node;
	node.childNodes.push(child);

	if (child.yogaNode) {
		node.yogaNode?.insertChild(
			child.yogaNode,
			node.yogaNode!.getChildCount(),
		);
	}

	if (node.nodeName === 'ink-text' || node.nodeName === 'ink-virtual-text') {
		markNodeAsDirty(node);
	}
};

export const insertBefore = (
	node: DOMElement,
	newChildNode: DOMNode,
	beforeChildNode: DOMNode,
): void => {
	if (newChildNode.parentNode) {
		removeChild(newChildNode.parentNode, newChildNode);
	}

	newChildNode.parentNode = node;

	const index = node.childNodes.indexOf(beforeChildNode);
	if (index >= 0) {
		node.childNodes.splice(index, 0, newChildNode);
		if (newChildNode.yogaNode) {
			node.yogaNode?.insertChild(newChildNode.yogaNode, index);
		}
	} else {
		node.childNodes.push(newChildNode);

		if (newChildNode.yogaNode) {
			node.yogaNode?.insertChild(
				newChildNode.yogaNode,
				node.yogaNode!.getChildCount(),
			);
		}
	}

	if (node.nodeName === 'ink-text' || node.nodeName === 'ink-virtual-text') {
		markNodeAsDirty(node);
	}
};

export const removeChild = (node: DOMElement, child: DOMNode): void => {
	if (child.yogaNode) {
		node.yogaNode?.removeChild(child.yogaNode);
		cleanupYogaNode(child.yogaNode);
	}

	child.parentNode = undefined;

	const index = node.childNodes.indexOf(child);
	if (index >= 0) {
		node.childNodes.splice(index, 1);
	}

	if (node.nodeName === 'ink-text' || node.nodeName === 'ink-virtual-text') {
		markNodeAsDirty(node);
	}
};

export const setAttribute = (
	node: DOMElement,
	key: string,
	value: DOMNodeAttribute,
): void => {
	node.attributes[key] = value;
};

export const setStyle = (node: DOMNode, style?: Styles): void => {
	node.style = style ?? {};
};

export const setTextNodeValue = (node: TextNode, text: string): void => {
	if (typeof text !== 'string') {
		text = String(text);
	}

	node.nodeValue = text;
	markNodeAsDirty(node);
};

export const appendChildToContainer = (
	container: DOMElement,
	child: DOMNode,
): void => {
	appendChild(container, child);
};

export const removeChildFromContainer = (
	container: DOMElement,
	child: DOMNode,
): void => {
	removeChild(container, child);
};

export const insertBeforeInContainer = (
	container: DOMElement,
	child: DOMNode,
	beforeChild: DOMNode,
): void => {
	insertBefore(container, child, beforeChild);
};

export const addLayoutListener = (
	rootNode: DOMElement,
	listener: LayoutListener,
): (() => void) => {
	if (rootNode.nodeName !== 'ink-root') {
		return () => {};
	}

	rootNode.internal_layoutListeners ??= new Set();
	rootNode.internal_layoutListeners.add(listener);

	return () => {
		rootNode.internal_layoutListeners?.delete(listener);
	};
};

export const emitLayoutListeners = (rootNode: DOMElement): void => {
	if (rootNode.nodeName !== 'ink-root' || !rootNode.internal_layoutListeners) {
		return;
	}

	for (const listener of rootNode.internal_layoutListeners) {
		listener();
	}
};
