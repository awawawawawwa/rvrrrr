// @vitest-environment jsdom
import {describe, it, expect, vi, beforeEach} from 'vitest';
import {renderHook, act} from '@testing-library/react';
import React, {createElement, useState} from 'react';
import {FocusContext} from '../../contexts/focus-context.js';
import type {FocusContextValue} from '../../contexts/focus-context.js';
import {useFocus} from '../use-focus.js';

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

describe('useFocus', () => {
	it('calls add on mount with provided id and autoFocus false by default', () => {
		const ctx = createMockFocusContext();
		renderHook(() => useFocus({id: 'my-id'}), {
			wrapper: createWrapper(ctx),
		});
		expect(ctx.add).toHaveBeenCalledWith('my-id', {autoFocus: false});
	});

	it('calls remove on unmount', () => {
		const ctx = createMockFocusContext();
		const {unmount} = renderHook(() => useFocus({id: 'my-id'}), {
			wrapper: createWrapper(ctx),
		});
		unmount();
		expect(ctx.remove).toHaveBeenCalledWith('my-id');
	});

	it('calls add with autoFocus true when autoFocus option is true', () => {
		const ctx = createMockFocusContext();
		renderHook(() => useFocus({id: 'my-id', autoFocus: true}), {
			wrapper: createWrapper(ctx),
		});
		expect(ctx.add).toHaveBeenCalledWith('my-id', {autoFocus: true});
	});

	it('returns isFocused = true when activeId matches and focus is enabled', () => {
		const ctx = createMockFocusContext({activeId: 'my-id', isFocusEnabled: true});
		const {result} = renderHook(() => useFocus({id: 'my-id'}), {
			wrapper: createWrapper(ctx),
		});
		expect(result.current.isFocused).toBe(true);
	});

	it('returns isFocused = false when activeId does not match', () => {
		const ctx = createMockFocusContext({activeId: 'other-id', isFocusEnabled: true});
		const {result} = renderHook(() => useFocus({id: 'my-id'}), {
			wrapper: createWrapper(ctx),
		});
		expect(result.current.isFocused).toBe(false);
	});

	it('returns isFocused = false when focus system is disabled', () => {
		const ctx = createMockFocusContext({activeId: 'my-id', isFocusEnabled: false});
		const {result} = renderHook(() => useFocus({id: 'my-id'}), {
			wrapper: createWrapper(ctx),
		});
		expect(result.current.isFocused).toBe(false);
	});

	it('generates a stable id when none is provided', () => {
		const ctx = createMockFocusContext();
		renderHook(() => useFocus(), {
			wrapper: createWrapper(ctx),
		});
		expect(ctx.add).toHaveBeenCalledOnce();
		const [registeredId] = (ctx.add as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(typeof registeredId).toBe('string');
		expect(registeredId.length).toBeGreaterThan(0);
	});

	it('does not register when isActive is false', () => {
		const ctx = createMockFocusContext();
		renderHook(() => useFocus({id: 'my-id', isActive: false}), {
			wrapper: createWrapper(ctx),
		});
		expect(ctx.add).not.toHaveBeenCalled();
	});

	it('unregisters when isActive changes from true to false', () => {
		const ctx = createMockFocusContext();
		const {rerender} = renderHook(
			({isActive}: {isActive: boolean}) => useFocus({id: 'my-id', isActive}),
			{
				initialProps: {isActive: true},
				wrapper: createWrapper(ctx),
			},
		);
		expect(ctx.add).toHaveBeenCalledWith('my-id', {autoFocus: false});

		rerender({isActive: false});
		expect(ctx.remove).toHaveBeenCalledWith('my-id');
	});
});
