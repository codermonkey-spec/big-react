import { jsx, jsxDev, isValidElement as isValidElementFn } from './src/jsx';
import currentDispatcher, {
	Dispatch,
	resolveDispatcher
} from './src/currentDispatcher';
import { EffectCallback, EffectDeps } from 'react-reconciler/src/fiberHooks';

export const useState: Dispatch['useState'] = (initialState) => {
	const dispatcher = resolveDispatcher();

	return dispatcher.useState(initialState);
};
export const useEffect: Dispatch['useEffect'] = (create, deps) => {
	const dispatcher = resolveDispatcher();

	return dispatcher.useEffect(create, deps);
};

export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
	currentDispatcher
};

export const version = '0.0.0';

export const createElement = jsx;

export const isValidElement = isValidElementFn;

// export default {
// 	version: '0.0.0',
// 	createElement: jsxDev
// };
