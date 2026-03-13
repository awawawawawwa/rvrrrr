import React from 'react';
import Yoga from 'yoga-layout';
import ansiEscapes from 'ansi-escapes';
import {createNode} from '../dom/dom.js';
import type {DOMElement} from '../dom/types.js';
import {IpcRendererBridge} from '../bridge/ipc-child.js';
import {serializeTree} from '../protocol/serialize.js';
import reconciler from '../reconciler/reconciler.js';
import {AppContext} from '../contexts/app-context.js';
import {StdinContext, createSetRawMode} from '../contexts/stdin-context.js';
import {FocusContext} from '../contexts/focus-context.js';
import type {FocusContextValue} from '../contexts/focus-context.js';
import type {RenderOptions, Instance} from './types.js';
import type {ReactNode} from 'react';

function calculateLayout(
	rootNode: DOMElement,
	width: number,
	height: number,
): void {
	rootNode.yogaNode!.calculateLayout(width, height, Yoga.DIRECTION_LTR);
}

/**
 * Build an imperative FocusManager that can be used as a React context value.
 * Because render() is outside React, we manage state imperatively and re-render
 * the component tree when focus changes by calling a provided re-render callback.
 */
function createFocusManager(): FocusContextValue {
	const focusOrder: string[] = [];
	let activeId: string | undefined;
	let isFocusEnabled = true;

	const manager: FocusContextValue = {
		get activeId() {
			return activeId;
		},
		get isFocusEnabled() {
			return isFocusEnabled;
		},
		add(id: string, options: {autoFocus: boolean}) {
			if (!focusOrder.includes(id)) {
				focusOrder.push(id);
			}

			if (options.autoFocus && isFocusEnabled) {
				activeId = id;
			}
		},
		remove(id: string) {
			const index = focusOrder.indexOf(id);
			if (index !== -1) {
				focusOrder.splice(index, 1);
			}

			if (activeId === id) {
				activeId = focusOrder[0];
			}
		},
		next() {
			if (!isFocusEnabled || focusOrder.length === 0) return;
			const currentIndex =
				activeId !== undefined ? focusOrder.indexOf(activeId) : -1;
			const nextIndex = (currentIndex + 1) % focusOrder.length;
			activeId = focusOrder[nextIndex];
		},
		previous() {
			if (!isFocusEnabled || focusOrder.length === 0) return;
			const currentIndex =
				activeId !== undefined ? focusOrder.indexOf(activeId) : 0;
			const prevIndex =
				(currentIndex - 1 + focusOrder.length) % focusOrder.length;
			activeId = focusOrder[prevIndex];
		},
		focus(id: string) {
			if (focusOrder.includes(id)) {
				activeId = id;
			}
		},
		enableFocus() {
			isFocusEnabled = true;
		},
		disableFocus() {
			isFocusEnabled = false;
			activeId = undefined;
		},
	};

	return manager;
}

export function render(node: ReactNode, options?: RenderOptions): Instance {
	const stdout: NodeJS.WriteStream =
		options?.stdout ?? (process.stdout as NodeJS.WriteStream);
	const stdin: NodeJS.ReadStream =
		options?.stdin ?? (process.stdin as NodeJS.ReadStream);

	// 1. Create root DOM node
	const rootNode = createNode('ink-root');

	// 2. Create bridge
	const bridge = new IpcRendererBridge({maxFps: options?.maxFps ?? 30});

	// 3. Wire onComputeLayout
	rootNode.onComputeLayout = () => {
		calculateLayout(rootNode, stdout.columns ?? 80, stdout.rows ?? 24);
	};

	// 4. Wire onRender
	rootNode.onRender = () => {
		const tree = serializeTree(rootNode);
		if (tree.root) {
			bridge.enqueueRender(tree.root);
		}
	};

	// 5. Handle first-frame pitfall (Pitfall 4): after bridge is ready, push
	//    any frame that was dropped during startup
	void bridge.waitForReady().then(() => {
		rootNode.onRender?.();
	});

	// 6. Exit promise machinery
	let exitResolve!: () => void;
	let exitReject!: (err: Error) => void;
	const exitPromise = new Promise<void>((resolve, reject) => {
		exitResolve = resolve;
		exitReject = reject;
	});

	// 7. Context values

	// AppContext: expose exit() that resolves/rejects the exit promise
	let isMounted = true;
	const appContextValue = {
		exit(err?: Error) {
			if (!isMounted) return;
			isMounted = false;
			if (err) {
				exitReject(err);
			} else {
				exitResolve();
			}
		},
	};

	// StdinContext
	const setRawMode = createSetRawMode(stdin);
	const stdinContextValue = {
		stdin,
		isRawModeSupported: typeof stdin.setRawMode === 'function',
		setRawMode,
		internal_exitOnCtrlC: options?.exitOnCtrlC ?? true,
	};

	// FocusContext
	const focusManager = createFocusManager();

	// 8. Wrap element in context providers
	function wrapWithProviders(element: ReactNode): ReactNode {
		return React.createElement(
			AppContext.Provider,
			{value: appContextValue},
			React.createElement(
				StdinContext.Provider,
				{value: stdinContextValue},
				React.createElement(
					FocusContext.Provider,
					{value: focusManager},
					element,
				),
			),
		);
	}

	// 9. Create reconciler container and render
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

	reconciler.updateContainer(wrapWithProviders(node), container, null, null);

	// 10. Ctrl+C handling
	let ctrlCListener: ((data: Buffer) => void) | null = null;
	if (options?.exitOnCtrlC !== false) {
		ctrlCListener = (data: Buffer) => {
			if (data.toString('hex') === '03') {
				appContextValue.exit();
			}
		};

		stdin.on('data', ctrlCListener as (...args: unknown[]) => void);
	}

	// 11. Resize listener (LYOT-07, RUST-10)
	const onResize = () => {
		rootNode.onComputeLayout?.();
		rootNode.onRender?.();
		bridge.sendResize(stdout.columns ?? 80, stdout.rows ?? 24);
	};

	stdout.on('resize', onResize);

	// 12. Instance implementation
	let unmounted = false;
	const instance: Instance = {
		rerender(nextNode: ReactNode) {
			reconciler.updateContainer(
				wrapWithProviders(nextNode),
				container,
				null,
				null,
			);
		},

		unmount() {
			if (unmounted) return;
			unmounted = true;

			// Remove listeners
			stdout.off('resize', onResize);
			if (ctrlCListener !== null) {
				stdin.off('data', ctrlCListener as (...args: unknown[]) => void);
			}

			// Unmount React tree, then shutdown bridge and resolve exit promise
			reconciler.updateContainer(null, container, null, () => {
				void bridge.shutdown().then(() => {
					exitResolve();
				});
			});
		},

		waitUntilExit(): Promise<void> {
			return exitPromise;
		},

		clear() {
			stdout.write(ansiEscapes.clearTerminal);
		},
	};

	return instance;
}
