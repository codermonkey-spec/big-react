import {
	FulfilledThenable,
	PendingThenable,
	RejectedThenable,
	Thenable
} from 'shared/ReactTypes';

export const SuspenseException = new Error('这是一个Suspense的错误');

let suspendedThenable: Thenable<any> | null = null;

function noop() {}

export function getSuspenseThenable(): Thenable<any> {
	if (suspendedThenable === null) {
		throw new Error('应该存在suspendedThenable');
	}

	const thenable = suspendedThenable;
	suspendedThenable = null;
	return thenable;
}

export function trackUsedThenable<T>(thenable: Thenable<T>) {
	switch (thenable.status) {
		case 'fulfilled':
			return thenable.value;
		case 'rejected':
			throw thenable.reason;
		default:
			if (typeof thenable.status === 'string') {
				thenable.then(noop, noop);
			} else {
				const pending = thenable as unknown as PendingThenable<T, void, any>;
				pending.status = 'pending';

				pending.then(
					(val) => {
						if (pending.status === 'pending') {
							//@ts-ignore
							const fulfilled: FulfilledThenable<T, void, any> = pending;
							fulfilled.status = 'fulfilled';
							fulfilled.value = val;
						}
					},
					(err) => {
						if (pending.status === 'pending') {
							//@ts-ignore
							const rejected: RejectedThenable<T, void, any> = pending;
							rejected.status = 'rejected';
							rejected.reason = err;
						}
					}
				);
			}
			break;
	}
	suspendedThenable = thenable;
	throw SuspenseException;
}
