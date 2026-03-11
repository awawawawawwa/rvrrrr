import {describe, it, expect} from 'vitest';
import Yoga from 'yoga-layout';
import applyStyles from '../src/layout/styles.js';

describe('Yoga Layout', () => {
	it('applies flexbox props correctly (LYOT-02)', () => {
		const node = Yoga.Node.create();
		applyStyles(node, {
			flexDirection: 'row',
			flexWrap: 'wrap',
			flexGrow: 1,
			flexShrink: 0,
			justifyContent: 'space-between',
			alignItems: 'center',
			alignSelf: 'flex-start',
		});

		expect(node.getFlexDirection()).toBe(Yoga.FLEX_DIRECTION_ROW);
		expect(node.getFlexWrap()).toBe(Yoga.WRAP_WRAP);
		expect(node.getFlexGrow()).toBe(1);
		expect(node.getFlexShrink()).toBe(0);
		expect(node.getJustifyContent()).toBe(Yoga.JUSTIFY_SPACE_BETWEEN);
		expect(node.getAlignItems()).toBe(Yoga.ALIGN_CENTER);

		node.freeRecursive();
	});

	it('applies dimension props with percentages (LYOT-03)', () => {
		const parent = Yoga.Node.create();
		parent.setWidth(100);
		parent.setHeight(50);

		const child = Yoga.Node.create();
		applyStyles(child, {width: '50%', height: '100%'});

		parent.insertChild(child, 0);
		parent.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

		expect(child.getComputedWidth()).toBe(50);
		expect(child.getComputedHeight()).toBe(50);

		parent.freeRecursive();
	});

	it('applies spacing props (LYOT-04)', () => {
		const node = Yoga.Node.create();
		applyStyles(node, {padding: 2, margin: 1, gap: 1});

		expect(node.getPadding(Yoga.EDGE_TOP).value).toBe(2);
		expect(node.getMargin(Yoga.EDGE_TOP).value).toBe(1);

		node.freeRecursive();
	});

	it('applies position absolute (LYOT-05)', () => {
		const node = Yoga.Node.create();
		applyStyles(node, {position: 'absolute'});

		expect(node.getPositionType()).toBe(Yoga.POSITION_TYPE_ABSOLUTE);

		node.freeRecursive();
	});

	it('computes flex row layout with correct positions (LYOT-01)', () => {
		const root = Yoga.Node.create();
		root.setWidth(80);
		root.setHeight(24);
		root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);

		const child1 = Yoga.Node.create();
		child1.setWidth(20);
		child1.setHeight(5);

		const child2 = Yoga.Node.create();
		child2.setWidth(30);
		child2.setHeight(5);

		root.insertChild(child1, 0);
		root.insertChild(child2, 1);
		root.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

		expect(child1.getComputedLeft()).toBe(0);
		expect(child1.getComputedTop()).toBe(0);
		expect(child1.getComputedWidth()).toBe(20);

		expect(child2.getComputedLeft()).toBe(20);
		expect(child2.getComputedTop()).toBe(0);
		expect(child2.getComputedWidth()).toBe(30);

		root.freeRecursive();
	});
});
