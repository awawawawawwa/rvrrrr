import type {ReactNode} from 'react';
import Yoga from 'yoga-layout';
import {createNode} from '../dom/dom.js';
import type {DOMElement} from '../dom/types.js';
import reconciler from '../reconciler/reconciler.js';
import squashTextNodes from '../layout/squash-text-nodes.js';
import wrapText from '../layout/wrap-text.js';
import {Output} from './output.js';

export type RenderToStringOptions = {
	columns?: number;
	rows?: number;
};

/**
 * Recursively paint a DOM node into the Output character grid.
 */
function paintNode(
	node: DOMElement,
	output: Output,
	parentX: number,
	parentY: number,
	width: number,
): void {
	if (!node.yogaNode) return;
	if (node.yogaNode.getDisplay() === Yoga.DISPLAY_NONE) return;

	const left = node.yogaNode.getComputedLeft();
	const top = node.yogaNode.getComputedTop();
	const nodeWidth = node.yogaNode.getComputedWidth();

	const absX = parentX + left;
	const absY = parentY + top;

	if (node.nodeName === 'ink-text') {
		// Collect text content with transforms
		const content = squashTextNodes(node);
		if (!content) return;

		const textWrap = node.style.textWrap ?? 'wrap';
		const wrappedContent = wrapText(
			content,
			Math.round(nodeWidth) || width,
			textWrap,
		);
		const lines = wrappedContent.split('\n');

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (line === undefined) continue;

			// Apply internal_transform if present
			const transformedLine =
				typeof node.internal_transform === 'function'
					? node.internal_transform(line, i)
					: line;

			output.write(Math.round(absX), Math.round(absY) + i, transformedLine);
		}

		return;
	}

	// ink-box, ink-root — recurse into children
	for (const child of node.childNodes) {
		if (child.nodeName === '#text') continue;
		paintNode(child as DOMElement, output, absX, absY, nodeWidth);
	}
}

/**
 * Synchronously render a React element to a string.
 * Does not require or interact with the Rust bridge.
 */
export function renderToString(
	node: ReactNode,
	options?: RenderToStringOptions,
): string {
	const columns = options?.columns ?? 80;
	const rows = options?.rows ?? 24;

	// Create temporary root DOM node
	const rootNode: DOMElement = createNode('ink-root');

	// Set up layout calculation callback (called by reconciler after commit)
	rootNode.onComputeLayout = () => {
		rootNode.yogaNode!.calculateLayout(columns, rows, Yoga.DIRECTION_LTR);
	};

	// Create reconciler container
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const container = (reconciler as any).createContainer(
		rootNode,
		0,
		null,
		false,
		null,
		'',
		{},
		null,
	);

	// flushSyncFromReconciler ensures synchronous commit before we proceed
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(reconciler as any).flushSyncFromReconciler(() => {
		reconciler.updateContainer(node, container, null, null);
	});

	// Trigger layout (also fired by resetAfterCommit -> onComputeLayout)
	rootNode.yogaNode!.calculateLayout(columns, rows, Yoga.DIRECTION_LTR);

	// Paint the DOM tree into an Output grid
	const output = new Output();
	paintNode(rootNode, output, 0, 0, columns);

	// Clean up: unmount the React tree
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(reconciler as any).flushSyncFromReconciler(() => {
		reconciler.updateContainer(null, container, null, null);
	});

	return output.get(columns, rows);
}
