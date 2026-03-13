import type {WidgetNode} from '../protocol/types.js';

// Messages sent FROM JS TO Rust (over child stdin)
export type RenderMessageIn = {type: 'render'; frameId: number; root: WidgetNode};
export type ResizeMessageIn = {type: 'resize'; width: number; height: number};
export type ShutdownMessageIn = {type: 'shutdown'};
export type RendererMessageIn = RenderMessageIn | ResizeMessageIn | ShutdownMessageIn;

// Input event shape matching Ink's useInput expectations
export type KeyInfo = {
	upArrow: boolean;
	downArrow: boolean;
	leftArrow: boolean;
	rightArrow: boolean;
	return: boolean;
	escape: boolean;
	ctrl: boolean;
	shift: boolean;
	tab: boolean;
	backspace: boolean;
	delete: boolean;
	meta: boolean;
};

export type InputEvent = {
	input: string;
	key: KeyInfo;
};

// Messages sent FROM Rust TO JS (over child stdout)
export type ReadyMessageOut = {type: 'ready'};
export type RenderedMessageOut = {type: 'rendered'; frameId: number};
export type InputMessageOut = {type: 'input'; event: InputEvent};
export type ErrorMessageOut = {type: 'error'; message: string; code?: string};
export type FatalMessageOut = {type: 'fatal'; message: string; code?: string};
export type RendererMessageOut =
	| ReadyMessageOut
	| RenderedMessageOut
	| InputMessageOut
	| ErrorMessageOut
	| FatalMessageOut;

export type BridgeOptions = {
	binaryPath?: string; // explicit path override
	maxFps?: number; // default 30
	onInput?: (event: InputEvent) => void;
	onError?: (error: Error) => void;
};

export type BridgeState =
	| 'starting'
	| 'ready'
	| 'running'
	| 'stopping'
	| 'stopped'
	| 'crashed';
