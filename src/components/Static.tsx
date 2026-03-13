import React, {useRef, type ReactNode} from 'react';
import {type Styles} from '../layout/styles.js';

export type StaticProps<T> = {
	/**
	 * Array of items to render. Only new items (not previously rendered) are
	 * passed to the children function on each render cycle.
	 */
	readonly items: T[];
	/**
	 * Render function called for each item.
	 */
	readonly children: (item: T, index: number) => ReactNode;
	/**
	 * Optional style for the wrapping box.
	 */
	readonly style?: Styles;
};

/**
 * Static renders items as permanent output above dynamic content.
 * It tracks previously rendered items via a ref and only renders new ones.
 * The component's root DOM node has `internal_static = true` which signals
 * the render pipeline to treat this content as static (above-the-fold) output.
 */
function Static<T>({items, children, style}: StaticProps<T>): ReactNode {
	const previousCountRef = useRef(0);

	// Only render items that haven't been rendered before
	const newItems = items.slice(previousCountRef.current);
	previousCountRef.current = items.length;

	if (newItems.length === 0) {
		return null;
	}

	return (
		<ink-box internal_static={true} style={style ?? {}}>
			{newItems.map((item, offsetIndex) => {
				const absoluteIndex = items.length - newItems.length + offsetIndex;
				return children(item, absoluteIndex);
			})}
		</ink-box>
	);
}

export default Static;
