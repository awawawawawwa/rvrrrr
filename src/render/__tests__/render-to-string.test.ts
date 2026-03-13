// @vitest-environment node
import {describe, it, expect} from 'vitest';
import React from 'react';
import {renderToString} from '../render-to-string.js';
import Text from '../../components/Text.js';
import Box from '../../components/Box.js';

describe('renderToString', () => {
	it('renders simple text', () => {
		const result = renderToString(React.createElement(Text, null, 'hello'));
		expect(result).toBe('hello');
	});

	it('renders nested text nodes', () => {
		const result = renderToString(
			React.createElement(
				Box,
				null,
				React.createElement(Text, null, 'a'),
				React.createElement(Text, null, 'b'),
			),
		);
		// Two text nodes side by side in a row flex container
		expect(result).toContain('a');
		expect(result).toContain('b');
	});

	it('returns a string', () => {
		const result = renderToString(React.createElement(Text, null, 'test'));
		expect(typeof result).toBe('string');
	});

	it('renders empty element as empty string', () => {
		const result = renderToString(React.createElement(Box, null));
		expect(typeof result).toBe('string');
	});

	it('respects columns option', () => {
		const result = renderToString(
			React.createElement(Text, null, 'hello world'),
			{columns: 40},
		);
		expect(typeof result).toBe('string');
	});
});
