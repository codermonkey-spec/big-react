import { Action } from 'shared/ReactTypes';

export interface Dispacher {
	useState: <T>(initialState: () => T | T) => [T, Dispach<T>];
}

export type Dispach<State> = (action: Action<State>) => void;
const currentDispatcher: { current: Dispacher | null } = {
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
