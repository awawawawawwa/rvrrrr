import {type Styles} from '../layout/styles.js';
import {type OutputTransformer} from '../dom/types.js';

type InkElementProps = {
	style?: Styles;
	internal_transform?: OutputTransformer;
	internal_static?: boolean;
	children?: React.ReactNode;
};

declare module 'react' {
	namespace JSX {
		interface IntrinsicElements {
			'ink-box': InkElementProps;
			'ink-text': InkElementProps;
			'ink-virtual-text': InkElementProps;
			'ink-root': InkElementProps;
		}
	}
}
