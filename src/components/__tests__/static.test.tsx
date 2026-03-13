// @vitest-environment node
import {describe, it, expect} from 'vitest';
import React from 'react';
import {renderToString} from '../../render/render-to-string.js';
import Static from '../Static.js';
import Text from '../Text.js';

describe('Static', () => {
	it('renders items via children function', () => {
		const items = ['foo', 'bar'];
		const result = renderToString(
			<Static items={items}>
				{(item) => <Text key={item}>{item}</Text>}
			</Static>,
		);
		expect(result).toContain('foo');
		expect(result).toContain('bar');
	});

	it('sets internal_static on its DOM node', () => {
		const items = ['hello'];
		const result = renderToString(
			<Static items={items}>
				{(item) => <Text key={item}>{item}</Text>}
			</Static>,
		);
		expect(result).toContain('hello');
	});

	it('renders with empty items array without error', () => {
		const result = renderToString(
			<Static items={[]}>
				{(item: string) => <Text key={item}>{item}</Text>}
			</Static>,
		);
		expect(typeof result).toBe('string');
	});

	it('passes item and index to children function', () => {
		const items = ['a', 'b', 'c'];
		const indices: number[] = [];
		renderToString(
			<Static items={items}>
				{(item, index) => {
					indices.push(index);
					return <Text key={item}>{item}</Text>;
				}}
			</Static>,
		);
		expect(indices).toContain(0);
		expect(indices).toContain(1);
		expect(indices).toContain(2);
	});
});
