import {createContext} from 'react';

export type StdinContextValue = {
	/** The stdin stream. */
	stdin: NodeJS.ReadStream;
	/** Whether the terminal supports raw mode. */
	isRawModeSupported: boolean;
	/**
	 * Set stdin raw mode. Reference-counted — raw mode is enabled when the
	 * first caller passes `true` and disabled when the last caller passes `false`.
	 */
	setRawMode: (value: boolean) => void;
	/** Whether to exit when Ctrl+C is pressed. */
	internal_exitOnCtrlC: boolean;
};

export const StdinContext = createContext<StdinContextValue>(
	undefined as unknown as StdinContextValue,
);

StdinContext.displayName = 'StdinContext';

/**
 * Create the reference-counted setRawMode wrapper for a given stdin stream.
 *
 * The returned function increments an internal counter on `true` and decrements
 * it on `false`. `stdin.setRawMode()` is only called when transitioning between
 * 0 and 1 (i.e. first enable or last disable).
 */
export function createSetRawMode(
	stdin: NodeJS.ReadStream,
): (value: boolean) => void {
	let rawModeCount = 0;

	return (value: boolean) => {
		if (value) {
			rawModeCount++;
			if (rawModeCount === 1 && typeof stdin.setRawMode === 'function') {
				stdin.setRawMode(true);
			}
		} else {
			rawModeCount = Math.max(0, rawModeCount - 1);
			if (rawModeCount === 0 && typeof stdin.setRawMode === 'function') {
				stdin.setRawMode(false);
			}
		}
	};
}
