import {type Node as YogaNode} from 'yoga-layout';
import {type Styles} from '../layout/styles.js';

export type OutputTransformer = (s: string, index: number) => string;

export type TextName = '#text';
export type ElementNames =
	| 'ink-root'
	| 'ink-box'
	| 'ink-text'
	| 'ink-virtual-text';

export type NodeNames = ElementNames | TextName;

export type DOMElement = {
	nodeName: ElementNames;
	attributes: Record<string, DOMNodeAttribute>;
	childNodes: DOMNode[];
	internal_transform?: OutputTransformer;
	parentNode?: DOMElement;
	yogaNode?: YogaNode;
	internal_static?: boolean;
	staticNode?: DOMElement;
	isStaticDirty?: boolean;
	onComputeLayout?: () => void;
	onRender?: () => void;
	onImmediateRender?: () => void;
	internal_layoutListeners?: Set<() => void>;
	style: Styles;
};

export type TextNode = {
	nodeName: TextName;
	nodeValue: string;
	yogaNode?: YogaNode;
	parentNode?: DOMElement;
	style: Styles;
};

export type DOMNode = DOMElement | TextNode;

export type DOMNodeAttribute = boolean | string | number;
