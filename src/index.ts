// Reconciler
export {reconciler} from './reconciler/index.js';

// DOM
export {
	createNode,
	createTextNode,
	appendChild,
	removeChild,
	insertBefore,
	setAttribute,
	setTextNodeValue,
} from './dom/index.js';

export type {
	DOMElement,
	TextNode,
	DOMNode,
	DOMNodeAttribute,
	OutputTransformer,
	NodeNames,
} from './dom/index.js';

// Layout
export {
	applyStyles,
	measureText,
	wrapText,
	squashTextNodes,
	getMaxWidth,
} from './layout/index.js';

export type {Styles} from './layout/index.js';

// Components
export {
	Box,
	Text,
	Newline,
	Spacer,
	Transform,
} from './components/index.js';

export type {
	BoxProps,
	TextProps,
	NewlineProps,
	TransformProps,
} from './components/index.js';

export {TextContext} from './components/context.js';

// Protocol
export {
	serializeTree,
	encodeMessage,
	encodeMessages,
	createErrorMessage,
	ErrorCodes,
} from './protocol/index.js';

export type {
	WidgetNode,
	BoxNode,
	TextNode as ProtocolTextNode,
	Layout,
	Padding,
	Border,
	BoxStyleWire,
	RenderMessage,
	ErrorMessage,
	ProtocolMessage,
} from './protocol/index.js';
