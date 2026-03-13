import {createContext} from 'react';

export type FocusContextValue = {
	/** The currently focused component id, or undefined if nothing is focused. */
	activeId: string | undefined;
	/**
	 * Register a focusable component. If `autoFocus` is true the component
	 * receives focus immediately upon registration.
	 */
	add: (id: string, options: {autoFocus: boolean}) => void;
	/** Unregister a focusable component. */
	remove: (id: string) => void;
	/** Move focus to the next component in registration order (wraps). */
	next: () => void;
	/** Move focus to the previous component in registration order (wraps). */
	previous: () => void;
	/** Set focus directly to the given id. */
	focus: (id: string) => void;
	/** Enable the focus system (focus navigation active). */
	enableFocus: () => void;
	/** Disable the focus system (no component receives focus). */
	disableFocus: () => void;
	/** Whether the focus system is currently enabled. */
	isFocusEnabled: boolean;
};

export const FocusContext = createContext<FocusContextValue>(
	undefined as unknown as FocusContextValue,
);

FocusContext.displayName = 'FocusContext';
