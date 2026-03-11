import React, {useContext} from 'react';
import ansiStyles from 'ansi-styles';
import {type LiteralUnion} from 'type-fest';
import {type ForegroundColorName} from 'ansi-styles';
import {type OutputTransformer} from '../dom/types.js';
import {type Styles} from '../layout/styles.js';
import {TextContext} from './context.js';

export type TextProps = {
	readonly color?: LiteralUnion<ForegroundColorName, string>;
	readonly backgroundColor?: LiteralUnion<ForegroundColorName, string>;
	readonly dimColor?: boolean;
	readonly bold?: boolean;
	readonly italic?: boolean;
	readonly underline?: boolean;
	readonly strikethrough?: boolean;
	readonly inverse?: boolean;
	readonly wrap?:
		| 'wrap'
		| 'truncate'
		| 'truncate-start'
		| 'truncate-middle'
		| 'truncate-end';
	readonly children?: React.ReactNode;
};

type ColorMapping = Record<string, {open: string; close: string}>;

const foregroundColors = ansiStyles.color as unknown as ColorMapping;
const backgroundColors = ansiStyles.bgColor as unknown as ColorMapping;

function colorize(
	color: string,
	lookup: ColorMapping,
	colorBase: typeof ansiStyles.color | typeof ansiStyles.bgColor,
): {open: string; close: string} {
	if (color in lookup) {
		return lookup[color]!;
	}

	if (color.startsWith('#')) {
		const [r, g, b] = ansiStyles.hexToRgb(color);
		return {open: colorBase.ansi16m(r!, g!, b!), close: colorBase.close};
	}

	return {open: '', close: ''};
}

function buildTransform(props: TextProps): OutputTransformer | undefined {
	const ops: Array<{open: string; close: string}> = [];

	if (props.color) {
		ops.push(colorize(props.color, foregroundColors, ansiStyles.color));
	}

	if (props.backgroundColor) {
		const bgKey = `bg${props.backgroundColor.charAt(0).toUpperCase()}${props.backgroundColor.slice(1)}`;
		if (bgKey in backgroundColors) {
			ops.push(backgroundColors[bgKey]!);
		} else if (props.backgroundColor.startsWith('#')) {
			const [r, g, b] = ansiStyles.hexToRgb(props.backgroundColor);
			ops.push({
				open: ansiStyles.bgColor.ansi16m(r!, g!, b!),
				close: ansiStyles.bgColor.close,
			});
		}
	}

	if (props.bold) {
		ops.push(ansiStyles.bold);
	}

	if (props.italic) {
		ops.push(ansiStyles.italic);
	}

	if (props.underline) {
		ops.push(ansiStyles.underline);
	}

	if (props.strikethrough) {
		ops.push(ansiStyles.strikethrough);
	}

	if (props.inverse) {
		ops.push(ansiStyles.inverse);
	}

	if (props.dimColor) {
		ops.push(ansiStyles.dim);
	}

	if (ops.length === 0) {
		return undefined;
	}

	return (text: string) => {
		let result = text;
		for (const op of ops) {
			result = `${op.open}${result}${op.close}`;
		}

		return result;
	};
}

const wrapMap: Record<string, Styles['textWrap']> = {
	wrap: 'wrap',
	truncate: 'truncate-end',
	'truncate-start': 'truncate-start',
	'truncate-middle': 'truncate-middle',
	'truncate-end': 'truncate-end',
};

function Text({children, wrap = 'wrap', ...props}: TextProps): React.ReactElement {
	const isInsideText = useContext(TextContext);
	const transform = buildTransform(props);

	const style: Styles = {textWrap: wrapMap[wrap]};

	if (isInsideText) {
		return (
			<ink-virtual-text
				style={style}
				internal_transform={transform}
			>
				{children}
			</ink-virtual-text>
		);
	}

	return (
		<TextContext.Provider value={true}>
			<ink-text style={style} internal_transform={transform}>
				{children}
			</ink-text>
		</TextContext.Provider>
	);
}

export default Text;
