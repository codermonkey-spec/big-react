import { FiberNode } from './fiber';
import { popProvider } from './fiberContext';
import { DidCapture, NoFlags, Shouldcapture } from './fiberFlags';
import { popSuspenseHandler } from './suspenseContext';
import { ContextProvider, SuspenseComponent } from './workTags';

export function unwindWork(wip: FiberNode) {
	const flags = wip.flags;
	switch (wip.tag) {
		case SuspenseComponent:
			popSuspenseHandler();
			if (
				(flags & Shouldcapture) !== NoFlags &&
				(flags & DidCapture) === NoFlags
			) {
				wip.flags = (flags & ~Shouldcapture) | DidCapture;
				return wip;
			}
			break;
		case ContextProvider:
			const context = wip.type._context;
			popProvider(context);
			return null;
		default:
			return null;
	}

	return null;
}
