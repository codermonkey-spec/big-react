import { jsx, jsxDev, isValidElement as isValidElementFn } from './src/jsx';
import currentDispatcher, {
	Dispatch,
	resolveDispatcher
} from './src/currentDispatcher';
import currentBatchConfig from './src/curentBatchConfig';

export const useState: Dispatch['useState'] = (initialState) => {
	const dispatcher = resolveDispatcher();

	return dispatcher.useState(initialState);
};
export const useEffect: Dispatch['useEffect'] = (create, deps) => {
	const dispatcher = resolveDispatcher();

	return dispatcher.useEffect(create, deps);
};

export const useTrasition: Dispatch['useTrasition'] = () => {
	const dispatcher = resolveDispatcher();

	return dispatcher.useTrasition();
};

export const useRef: Dispatch['useRef'] = (initialValue) => {
	const dispatcher = resolveDispatcher();

	return dispatcher.useRef(initialValue);
};
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
	currentDispatcher,
	currentBatchConfig
};

export const version = '0.0.0';

export const createElement = jsx;

export const isValidElement = isValidElementFn;

// export default {
// 	version: '0.0.0',
// 	createElement: jsxDev
// };
