import {useEffect, useRef} from 'react';
import {parseKeypress} from './parse-keypress.js';
import {useStdin} from './use-stdin.js';
import type {Key} from './types.js';

type InputHandler = (input: string, key: Key) => void;

type UseInputOptions = {
	/**
	 * When false, the handler will not be called and raw mode will not be
	 * enabled. Defaults to true.
	 */
	isActive?: boolean;
};

/**
 * Calls handler(input, key) whenever stdin emits a 'data' event and
 * isActive is true (default).
 *
 * Enables raw mode on mount and disables it on cleanup.
 * Uses a stable ref for the handler so re-renders with a new handler
 * function do not cause re-subscription.
 */
export function useInput(
	handler: InputHandler,
	options: UseInputOptions = {},
): void {
	const {stdin, setRawMode} = useStdin();
	const isActive = options.isActive !== false; // default true

	// Stable ref — always points to the latest handler without triggering re-subscription.
	const handlerRef = useRef<InputHandler>(handler);
	handlerRef.current = handler;

	useEffect(() => {
		if (!isActive) {
			return;
		}

		setRawMode(true);

		function onData(data: Buffer): void {
			const {input, key} = parseKeypress(data);
			handlerRef.current(input, key);
		}

		stdin.on('data', onData);

		return () => {
			stdin.off('data', onData);
			setRawMode(false);
		};
	}, [isActive, stdin, setRawMode]);
}
