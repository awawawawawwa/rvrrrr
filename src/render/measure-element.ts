import type {RefObject} from 'react';
import type {DOMElement} from '../dom/types.js';

/**
 * Read the computed layout dimensions of a mounted DOM element.
 * Returns { width: 0, height: 0 } if the ref is not yet mounted or has no
 * Yoga node (e.g. ink-virtual-text nodes).
 */
export function measureElement(
	ref: RefObject<DOMElement | null>,
): {width: number; height: number} {
	if (!ref.current || !ref.current.yogaNode) {
		return {width: 0, height: 0};
	}

	return {
		width: ref.current.yogaNode.getComputedWidth(),
		height: ref.current.yogaNode.getComputedHeight(),
	};
}
