import {useContext} from 'react';
import {AppContext} from '../contexts/app-context.js';
import type {AppContextValue} from '../contexts/app-context.js';

/**
 * Returns { exit } from AppContext.
 * Throws if used outside an AppContext.Provider.
 */
export function useApp(): AppContextValue {
	const value = useContext(AppContext);
	if (value === undefined) {
		throw new Error(
			'useApp must be used within an AppContext.Provider',
		);
	}

	return value;
}
