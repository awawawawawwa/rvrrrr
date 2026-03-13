import {describe, it, expect, vi} from 'vitest';
import {renderHook} from '@testing-library/react';
import React, {createElement} from 'react';
import {AppContext} from '../../contexts/app-context.js';
import type {AppContextValue} from '../../contexts/app-context.js';
import {useApp} from '../use-app.js';

function createWrapper(value: AppContextValue) {
	return function Wrapper({children}: {children: React.ReactNode}) {
		return createElement(AppContext.Provider, {value}, children);
	};
}

describe('useApp', () => {
	it('returns exit function from AppContext', () => {
		const exit = vi.fn();
		const {result} = renderHook(() => useApp(), {
			wrapper: createWrapper({exit}),
		});
		expect(result.current.exit).toBe(exit);
	});

	it('exit function can be called with no arguments', () => {
		const exit = vi.fn();
		const {result} = renderHook(() => useApp(), {
			wrapper: createWrapper({exit}),
		});
		result.current.exit();
		expect(exit).toHaveBeenCalledWith(undefined);
	});

	it('exit function can be called with an error', () => {
		const exit = vi.fn();
		const {result} = renderHook(() => useApp(), {
			wrapper: createWrapper({exit}),
		});
		const err = new Error('test error');
		result.current.exit(err);
		expect(exit).toHaveBeenCalledWith(err);
	});

	it('throws when used outside AppContext.Provider', () => {
		// renderHook without wrapper uses undefined context value
		// The hook should detect this and throw
		expect(() => {
			renderHook(() => useApp());
		}).toThrow();
	});
});
