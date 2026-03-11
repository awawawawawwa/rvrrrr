import {type Node as YogaNode} from 'yoga-layout';

export type OutputTransformer = (s: string, index: number) => string;

/** Minimal style shape for DOMElement; full Styles type lives in layout/styles.ts */
export type DOMElementStyle = Record<string, unknown>;

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
	style: DOMElementStyle;
};

export type TextNode = {
	nodeName: TextName;
	nodeValue: string;
	yogaNode?: YogaNode;
	parentNode?: DOMElement;
	style: Record<string, never>;
};

export type DOMNode = DOMElement | TextNode;

export type DOMNodeAttribute = boolean | string | number;
