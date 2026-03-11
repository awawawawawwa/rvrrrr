import React from 'react';

export type NewlineProps = {
	count?: number;
};

const Newline = ({count = 1}: NewlineProps) =>
	React.createElement('ink-text', null, '\n'.repeat(count));

export default Newline;
