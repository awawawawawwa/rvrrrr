import {type DOMElement} from '../dom/types.js';
import sanitizeAnsi from './sanitize-ansi.js';

const squashTextNodes = (node: DOMElement): string => {
	let text = '';

	for (let index = 0; index < node.childNodes.length; index++) {
		const childNode = node.childNodes[index];

		if (childNode === undefined) {
			continue;
		}

		let nodeText = '';

		if (childNode.nodeName === '#text') {
			nodeText = childNode.nodeValue;
		} else {
			if (
				childNode.nodeName === 'ink-text' ||
				childNode.nodeName === 'ink-virtual-text'
			) {
				nodeText = squashTextNodes(childNode);
			}

			if (
				nodeText.length > 0 &&
				typeof childNode.internal_transform === 'function'
			) {
				nodeText = childNode.internal_transform(nodeText, index);
			}
		}

		text += nodeText;
	}

	return sanitizeAnsi(text);
};

export default squashTextNodes;
