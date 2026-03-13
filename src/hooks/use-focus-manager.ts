import {useContext} from 'react';
import {FocusContext} from '../contexts/focus-context.js';

type UseFocusManagerResult = {
	/** Move focus to the next registered component (wraps). */
	focusNext: () => void;
	/** Move focus to the previous registered component (wraps). */
	focusPrevious: () => void;
	/** Set focus directly to the component with the given id. */
	focus: (id: string) => void;
	/** Enable the focus system. */
	enableFocus: () => void;
	/** Disable the focus system. */
	disableFocus: () => void;
};

/**
 * Exposes programmatic focus navigation methods from FocusContext.
 * Throws if used outside a FocusContext.Provider.
 */
export function useFocusManager(): UseFocusManagerResult {
	const ctx = useContext(FocusContext);
	if (ctx === undefined) {
		throw new Error(
			'useFocusManager must be used within a FocusContext.Provider',
		);
	}

	return {
		focusNext: ctx.next,
		focusPrevious: ctx.previous,
		focus: ctx.focus,
		enableFocus: ctx.enableFocus,
		disableFocus: ctx.disableFocus,
	};
}
