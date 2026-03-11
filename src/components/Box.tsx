import type React from 'react';
import {type Boxes, type BoxStyle} from 'cli-boxes';
import {type LiteralUnion} from 'type-fest';
import {type ForegroundColorName} from 'ansi-styles';
import {type Styles} from '../layout/styles.js';

export type BoxProps = {
	readonly flexDirection?: Styles['flexDirection'];
	readonly flexWrap?: Styles['flexWrap'];
	readonly flexGrow?: Styles['flexGrow'];
	readonly flexShrink?: Styles['flexShrink'];
	readonly flexBasis?: Styles['flexBasis'];
	readonly alignItems?: Styles['alignItems'];
	readonly alignSelf?: Styles['alignSelf'];
	readonly alignContent?: Styles['alignContent'];
	readonly justifyContent?: Styles['justifyContent'];
	readonly width?: Styles['width'];
	readonly height?: Styles['height'];
	readonly minWidth?: Styles['minWidth'];
	readonly minHeight?: Styles['minHeight'];
	readonly maxWidth?: Styles['maxWidth'];
	readonly maxHeight?: Styles['maxHeight'];
	readonly aspectRatio?: Styles['aspectRatio'];
	readonly display?: Styles['display'];
	readonly position?: Styles['position'];
	readonly top?: Styles['top'];
	readonly right?: Styles['right'];
	readonly bottom?: Styles['bottom'];
	readonly left?: Styles['left'];
	readonly margin?: Styles['margin'];
	readonly marginX?: Styles['marginX'];
	readonly marginY?: Styles['marginY'];
	readonly marginTop?: Styles['marginTop'];
	readonly marginBottom?: Styles['marginBottom'];
	readonly marginLeft?: Styles['marginLeft'];
	readonly marginRight?: Styles['marginRight'];
	readonly padding?: Styles['padding'];
	readonly paddingX?: Styles['paddingX'];
	readonly paddingY?: Styles['paddingY'];
	readonly paddingTop?: Styles['paddingTop'];
	readonly paddingBottom?: Styles['paddingBottom'];
	readonly paddingLeft?: Styles['paddingLeft'];
	readonly paddingRight?: Styles['paddingRight'];
	readonly gap?: Styles['gap'];
	readonly columnGap?: Styles['columnGap'];
	readonly rowGap?: Styles['rowGap'];
	readonly overflow?: Styles['overflow'];
	readonly overflowX?: Styles['overflowX'];
	readonly overflowY?: Styles['overflowY'];
	readonly borderStyle?: keyof Boxes | BoxStyle;
	readonly borderTop?: boolean;
	readonly borderBottom?: boolean;
	readonly borderLeft?: boolean;
	readonly borderRight?: boolean;
	readonly borderColor?: LiteralUnion<ForegroundColorName, string>;
	readonly borderTopColor?: LiteralUnion<ForegroundColorName, string>;
	readonly borderBottomColor?: LiteralUnion<ForegroundColorName, string>;
	readonly borderLeftColor?: LiteralUnion<ForegroundColorName, string>;
	readonly borderRightColor?: LiteralUnion<ForegroundColorName, string>;
	readonly borderDimColor?: boolean;
	readonly borderTopDimColor?: boolean;
	readonly borderBottomDimColor?: boolean;
	readonly borderLeftDimColor?: boolean;
	readonly borderRightDimColor?: boolean;
	readonly backgroundColor?: LiteralUnion<ForegroundColorName, string>;
	readonly children?: React.ReactNode;
};

function Box({children, ...props}: BoxProps): React.ReactElement {
	const style: Styles = {};
	const styleKeys: Array<keyof Styles> = [
		'flexDirection',
		'flexWrap',
		'flexGrow',
		'flexShrink',
		'flexBasis',
		'alignItems',
		'alignSelf',
		'alignContent',
		'justifyContent',
		'width',
		'height',
		'minWidth',
		'minHeight',
		'maxWidth',
		'maxHeight',
		'aspectRatio',
		'display',
		'position',
		'top',
		'right',
		'bottom',
		'left',
		'margin',
		'marginX',
		'marginY',
		'marginTop',
		'marginBottom',
		'marginLeft',
		'marginRight',
		'padding',
		'paddingX',
		'paddingY',
		'paddingTop',
		'paddingBottom',
		'paddingLeft',
		'paddingRight',
		'gap',
		'columnGap',
		'rowGap',
		'overflow',
		'overflowX',
		'overflowY',
		'borderStyle',
		'borderTop',
		'borderBottom',
		'borderLeft',
		'borderRight',
		'borderColor',
		'borderTopColor',
		'borderBottomColor',
		'borderLeftColor',
		'borderRightColor',
		'borderDimColor',
		'borderTopDimColor',
		'borderBottomDimColor',
		'borderLeftDimColor',
		'borderRightDimColor',
		'backgroundColor',
	];

	for (const key of styleKeys) {
		if (key in props) {
			(style as Record<string, unknown>)[key] =
				(props as Record<string, unknown>)[key];
		}
	}

	return <ink-box style={style}>{children}</ink-box>;
}

export default Box;
