import {type Styles} from '../layout/styles.js';
import {type OutputTransformer} from '../dom/types.js';

declare global {
	namespace JSX {
		interface IntrinsicElements {
			'ink-box': {
				style?: Styles;
				internal_transform?: OutputTransformer;
				children?: React.ReactNode;
			};
			'ink-text': {
				style?: Styles;
				internal_transform?: OutputTransformer;
				children?: React.ReactNode;
			};
			'ink-virtual-text': {
				style?: Styles;
				internal_transform?: OutputTransformer;
				children?: React.ReactNode;
			};
			'ink-root': {
				style?: Styles;
				children?: React.ReactNode;
			};
		}
	}
}
