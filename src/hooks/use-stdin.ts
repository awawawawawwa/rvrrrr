import {useContext} from 'react';
import {StdinContext} from '../contexts/stdin-context.js';
import type {StdinContextValue} from '../contexts/stdin-context.js';

/**
 * Returns stdin context value: { stdin, isRawModeSupported, setRawMode }.
 * Throws if used outside a StdinContext.Provider.
 */
export function useStdin(): StdinContextValue {
	const value = useContext(StdinContext);
	if (value === undefined) {
		throw new Error(
			'useStdin must be used within a StdinContext.Provider',
		);
	}

	return value;
}
