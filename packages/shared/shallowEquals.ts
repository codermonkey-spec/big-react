export function shallowEqual(a: any, b: any): boolean {
	if (Object.is(a, b)) {
		return true;
	}

	if (
		typeof a !== 'object' ||
		a === null ||
		typeof b !== 'object' ||
		b === null
	) {
		return false;
	}
	const keyA = Object.keys(a);
	const keyB = Object.keys(b);

	if (keyA.length !== keyB.length) {
		return false;
	}

	for (let i = 0; i < keyA.length; i++) {
		const key = keyA[i];
		if (!{}.hasOwnProperty.call(b, key) || !Object.is(a[key], b[key])) {
			return false;
		}
	}

	return true;
}
