import { jsxDev } from './src/jsx';
import currentDispatcher, {
	Dispacher,
	resolveDispatcher
} from './src/currentDispatcher';

export const useState: Dispacher['useState'] = (initialState) => {
	const dispatcher = resolveDispatcher();

	return dispatcher.useState(initialState);
};

export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
	currentDispatcher
};

export default {
	version: '0.0.0',
	createElement: jsxDev
};
