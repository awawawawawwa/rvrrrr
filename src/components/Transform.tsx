import React from 'react';

export type TransformProps = {
	transform: (children: string, index: number) => string;
	children?: React.ReactNode;
};

const Transform = ({transform, children}: TransformProps) =>
	React.createElement(
		'ink-virtual-text',
		{internal_transform: transform},
		children,
	);

export default Transform;
