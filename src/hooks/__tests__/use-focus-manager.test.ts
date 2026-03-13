// @vitest-environment jsdom
import {describe, it, expect, vi} from 'vitest';
import {renderHook} from '@testing-library/react';
import React, {createElement} from 'react';
import {FocusContext} from '../../contexts/focus-context.js';
import type {FocusContextValue} from '../../contexts/focus-context.js';
import {useFocusManager} from '../use-focus-manager.js';

function createMockFocusContext(
	overrides: Partial<FocusContextValue> = {},
): FocusContextValue {
	return {
		activeId: undefined,
		add: vi.fn(),
		remove: vi.fn(),
		next: vi.fn(),
		previous: vi.fn(),
		focus: vi.fn(),
		enableFocus: vi.fn(),
		disableFocus: vi.fn(),
		isFocusEnabled: true,
		...overrides,
	};
}

function createWrapper(value: FocusContextValue) {
	return function Wrapper({children}: {children: React.ReactNode}) {
		return createElement(FocusContext.Provider, {value}, children);
	};
}

describe('useFocusManager', () => {
	it('returns focusNext which calls context.next', () => {
		const ctx = createMockFocusContext();
		const {result} = renderHook(() => useFocusManager(), {
			wrapper: createWrapper(ctx),
		});
		result.current.focusNext();
		expect(ctx.next).toHaveBeenCalledOnce();
	});

	it('returns focusPrevious which calls context.previous', () => {
		const ctx = createMockFocusContext();
		const {result} = renderHook(() => useFocusManager(), {
			wrapper: createWrapper(ctx),
		});
		result.current.focusPrevious();
		expect(ctx.previous).toHaveBeenCalledOnce();
	});

	it('returns focus(id) which calls context.focus', () => {
		const ctx = createMockFocusContext();
		const {result} = renderHook(() => useFocusManager(), {
			wrapper: createWrapper(ctx),
		});
		result.current.focus('some-id');
		expect(ctx.focus).toHaveBeenCalledWith('some-id');
	});

	it('returns enableFocus which calls context.enableFocus', () => {
		const ctx = createMockFocusContext();
		const {result} = renderHook(() => useFocusManager(), {
			wrapper: createWrapper(ctx),
		});
		result.current.enableFocus();
		expect(ctx.enableFocus).toHaveBeenCalledOnce();
	});

	it('returns disableFocus which calls context.disableFocus', () => {
		const ctx = createMockFocusContext();
		const {result} = renderHook(() => useFocusManager(), {
			wrapper: createWrapper(ctx),
		});
		result.current.disableFocus();
		expect(ctx.disableFocus).toHaveBeenCalledOnce();
	});

	it('throws when used outside FocusContext.Provider', () => {
		expect(() => {
			renderHook(() => useFocusManager());
		}).toThrow();
	});
});
