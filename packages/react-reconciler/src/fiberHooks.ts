import internals from 'shared/internals';
import { FiberNode } from './fiber';
import { Dispach, Dispacher } from 'react/src/currentDispatcher';

let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null = null;

const { currentDispatcher } = internals;

interface Hook {
	memoizedState: any;
	updateQueue: unknown;
	next: Hook | null;
}

export const renderWithHooks = (wip: FiberNode) => {
	currentlyRenderingFiber = wip;
	wip.memoizedState = null;

	const current = wip.alternate;

	if (current !== null) {
	} else {
		currentDispatcher.current = HooksDispatcherOnMount;
	}

	const Component = wip.type;
	const props = wip.pendingProps;
	const children = Component(props);

	currentlyRenderingFiber = null;

	return children;
};

export const HooksDispatcherOnMount: Dispacher = {
	useState: mountState
};

export function mountState<State>(
	initialState: State | (() => State)
): [State, Dispach<State>] {}
