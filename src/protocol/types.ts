export type Layout = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type Padding = {
	top: number;
	right: number;
	bottom: number;
	left: number;
};

export type BoxStyleWire = {
	topLeft: string;
	top: string;
	topRight: string;
	right: string;
	bottomRight: string;
	bottom: string;
	bottomLeft: string;
	left: string;
};

export type Border = {
	top: number;
	right: number;
	bottom: number;
	left: number;
	style: string | BoxStyleWire | null;
	color: string | null;
	topColor: string | null;
	rightColor: string | null;
	bottomColor: string | null;
	leftColor: string | null;
	dimColor: boolean;
	topDimColor: boolean;
	rightDimColor: boolean;
	bottomDimColor: boolean;
	leftDimColor: boolean;
};

export type BoxNode = {
	kind: 'box';
	layout: Layout;
	padding: Padding;
	border: Border;
	background: string | null;
	overflow: 'visible' | 'hidden';
	children: WidgetNode[];
};

export type TextNode = {
	kind: 'text';
	layout: Layout;
	content: string;
	wrap: string;
};

export type WidgetNode = BoxNode | TextNode;

export type RenderMessage = {
	type: 'render';
	root: WidgetNode;
};

export type ErrorMessage = {
	type: 'error';
	message: string;
	code?: string;
};

export type ProtocolMessage = RenderMessage | ErrorMessage;
