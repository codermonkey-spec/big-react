import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import type {
	Type,
	Key,
	Ref,
	Props,
	ReactElement,
	ElementType
} from 'shared/ReactTypes';

const ReactElement = (
	type: Type,
	key: Key,
	ref: Ref,
	props: Props
): ReactElement => {
	const element = {
		$$typeof: REACT_ELEMENT_TYPE,
		type,
		key,
		ref,
		props,
		__mark: 'kasong'
	};
	return element;
};

export const jsx = (type: ElementType, config: any, ...maybeChild: any) => {
	let props: Props = {};
	let key: Key = null;
	let ref: Ref = null;

	for (const prop of config) {
		const val = config[prop];
		if (prop === 'key') {
			if (val !== undefined) {
				key = '' + val;
			}
			continue;
		}

		if (prop === 'ref') {
			if (val !== undefined) {
				ref = val;
			}
			continue;
		}

		if ({}.hasOwnProperty.call(config, prop)) {
			props[prop] = val;
		}
	}

	const meybeChildrenLength = maybeChild.length;

	if (meybeChildrenLength) {
		if (meybeChildrenLength === 1) {
			props.children = maybeChild[0];
		} else {
			props.children = maybeChild;
		}
	}

	return ReactElement(type, key, ref, props);
};

export const jsxDEV = jsx;
