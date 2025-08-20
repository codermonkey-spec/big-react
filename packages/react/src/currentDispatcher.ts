import { Action, ReactContext, Usable } from 'shared/ReactTypes';

export interface Dispatch {
	useState: <T>(initialState: () => T | T) => [T, Dispach<T>];
	useEffect: (callback: () => void | void, deps: any[] | void) => void;
	useTrasition: () => [boolean, (callback: () => void) => void];
	useRef: <T>(initialValue: T) => { current: T };
	useContext: <T>(context: ReactContext<T>) => T;
	use: <T>(usable: Usable<T>) => T;
}

export type Dispach<State> = (action: Action<State>) => void;
const currentDispatcher: { current: Dispatch | null } = {
	current: null
};

export const resolveDispatcher = () => {
	const dispatcher = currentDispatcher.current;

	if (dispatcher === null) {
		throw new Error('hooks只能在函数组件中执行');
	}

	return dispatcher;
};

export default currentDispatcher;
