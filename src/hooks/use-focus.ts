import {useContext, useEffect, useRef} from 'react';
import {FocusContext} from '../contexts/focus-context.js';

type UseFocusOptions = {
	/**
	 * If true, the component receives focus immediately upon registration.
	 * Defaults to false.
	 */
	autoFocus?: boolean;
	/**
	 * When false, the component is not registered in the focus system.
	 * Defaults to true.
	 */
	isActive?: boolean;
	/** Explicit id for this focusable component. Auto-generated if omitted. */
	id?: string;
};

type UseFocusResult = {
	/** Whether this component currently holds focus. */
	isFocused: boolean;
};

let focusIdCounter = 0;

/**
 * Registers this component as a focusable element.
 *
 * - Registers with FocusContext on mount, unregisters on unmount.
 * - Returns { isFocused } derived from the current activeId.
 * - autoFocus: true causes immediate focus on registration.
 * - isActive: false removes the component from the focus system.
 */
export function useFocus(options: UseFocusOptions = {}): UseFocusResult {
	const {autoFocus = false, isActive = true, id: providedId} = options;

	const ctx = useContext(FocusContext);
	if (ctx === undefined) {
		throw new Error('useFocus must be used within a FocusContext.Provider');
	}

	// Generate a stable id for the lifetime of the component.
	const idRef = useRef<string>(
		providedId ?? `focus-${++focusIdCounter}`,
	);
	const id = idRef.current;

	useEffect(() => {
		if (!isActive) {
			return;
		}

		ctx.add(id, {autoFocus});

		return () => {
			ctx.remove(id);
		};
	}, [isActive, id, autoFocus, ctx]);

	const isFocused = isActive && ctx.isFocusEnabled && ctx.activeId === id;

	return {isFocused};
}
