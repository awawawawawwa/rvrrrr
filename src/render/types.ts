import type {ReactNode} from 'react';

export type {ReactNode};

export interface RenderOptions {
	stdout?: NodeJS.WriteStream;
	stdin?: NodeJS.ReadStream;
	stderr?: NodeJS.WriteStream;
	debug?: boolean;
	exitOnCtrlC?: boolean; // default: true
	patchConsole?: boolean; // default: false
	maxFps?: number; // default: 30, passed to bridge
}

export interface Instance {
	rerender: (node: ReactNode) => void;
	unmount: () => void;
	waitUntilExit: () => Promise<void>;
	clear: () => void;
}
