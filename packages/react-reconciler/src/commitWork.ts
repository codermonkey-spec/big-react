import {
	appendChildToContainer,
	commitUpdate,
	Container,
	hideInstance,
	hideTextInstance,
	insertChildToContainer,
	Instance,
	removeChild,
	unHideInstance,
	unHideTextInstance
} from 'hostConfig';
import { FiberNode, FiberRootNode, PendingPassiveEffects } from './fiber';
import {
	ChildDeletion,
	Flags,
	LayoutMask,
	MutationMask,
	NoFlags,
	PassiveEffect,
	PassiveMask,
	Placement,
	Ref,
	Update,
	Visibility
} from './fiberFlags';
import {
	FunctionComponent,
	HostCompoment,
	HostRoot,
	HostText,
	OffscreenComponent
} from './workTags';
import { UpdateQueue } from './updateQueue';
import { Effect, FCUpdateQueue } from './fiberHooks';
import { HookHasEffect, Passive } from './hookEffectTag';

let nextEffect: FiberNode | null = null;

export const commitEffects = (
	phrase: 'mutation' | 'layout',
	mask: Flags,
	callback: (fiber: FiberNode, root: FiberRootNode) => void
) => {
	return (finishedWork: FiberNode, root: FiberRootNode) => {
		nextEffect = finishedWork;

		while (nextEffect !== null) {
			const child: FiberNode | null = nextEffect.child;
			if ((nextEffect.subtreeFlags & mask) !== NoFlags && child !== null) {
				nextEffect = child;
			} else {
				up: while (nextEffect !== null) {
					callback(nextEffect, root);
					const sibling: FiberNode | null = nextEffect.sibling;
					if (sibling !== null) {
						nextEffect = sibling;
						break up;
					}

					nextEffect = nextEffect.return;
				}
			}
		}
	};
};

export const commitLayoutEffectsOnFiber = (
	finishedWork: FiberNode,
	root: FiberRootNode
) => {
	const flags = finishedWork.flags;
	const tag = finishedWork.tag;

	if ((flags & Ref) !== NoFlags && tag === HostCompoment) {
		// 绑定新的ref
		safelyAttachRef(finishedWork);
		finishedWork.flags &= ~Ref;
	}
};

export function safelyAttachRef(fiber: FiberNode) {
	const ref = fiber.ref;
	if (ref !== null) {
		const instance = fiber.stateNode;
		if (typeof ref === 'function') {
			ref(instance);
		} else {
			ref.current = instance;
		}
	}
}

export const commitMutationEffectsOnFiber = (
	finishedWork: FiberNode,
	root: FiberRootNode
) => {
	const flags = finishedWork.flags;
	const tag = finishedWork.tag;

	if ((flags & Placement) !== NoFlags) {
		commitPlacement(finishedWork);
		finishedWork.flags &= ~Placement;
	}

	if ((flags & Update) !== NoFlags) {
		commitUpdate(finishedWork);
		finishedWork.flags &= ~Update;
	}

	if ((flags & ChildDeletion) !== NoFlags) {
		const deletions = finishedWork.deletions;
		if (deletions !== null) {
			deletions.forEach((childToDelete) => {
				commitDeletion(childToDelete, root);
			});
		}
		finishedWork.flags &= ~ChildDeletion;
	}

	if ((flags & PassiveEffect) !== NoFlags) {
		// 收集回调
		commitPassiveEffect(finishedWork, root, 'update');
		finishedWork.flags &= ~PassiveEffect;
	}

	if ((flags & Ref) !== NoFlags && tag === HostCompoment) {
		safelyDetachRef(finishedWork);
	}

	if ((flags & Visibility) !== NoFlags && tag === OffscreenComponent) {
		const isHidden = finishedWork.pendingProps.mode === 'hidden';
		hideOrUnhideAllChildren(finishedWork, isHidden);
		finishedWork.flags &= ~Visibility;
	}
};

export function hideOrUnhideAllChildren(
	finishedWork: FiberNode,
	isHidden: boolean
) {
	findHostSubtreeRoot(finishedWork, (hostRoot) => {
		const instance = hostRoot.stateNode;
		if (hostRoot.tag === HostCompoment) {
			isHidden ? hideInstance(instance) : unHideInstance(instance);
		} else if (hostRoot.tag === HostText) {
			isHidden
				? hideTextInstance(instance)
				: unHideTextInstance(instance, hostRoot.memoizedProps.content);
		}
	});
}

export function findHostSubtreeRoot(
	finishedWork: FiberNode,
	callback: (hostSubtreeRoot: FiberNode) => void
) {
	let node = finishedWork;
	let hostSubtreeRoot = null;

	while (true) {
		if (node.tag === HostCompoment) {
			if (hostSubtreeRoot === null) {
				hostSubtreeRoot = node;
				callback(node);
			}
		} else if (node.tag === HostText) {
			if (hostSubtreeRoot === null) {
				callback(node);
			}
		} else if (
			node.tag === OffscreenComponent &&
			node.pendingProps.mode === 'hidden' &&
			node !== finishedWork
		) {
		} else if (node.child !== null) {
			node.child.return = node;
			node = node.child;
			continue;
		}

		if (node === finishedWork) {
			return;
		}

		while (node.sibling === null) {
			if (node.return === null || node.return === finishedWork) {
				return;
			}

			if (hostSubtreeRoot === node) {
				hostSubtreeRoot = null;
			}
			node = node.return;
		}

		if (hostSubtreeRoot === node) {
			hostSubtreeRoot = null;
		}
		node.sibling!.return = node.return;
		node = node.sibling;
	}
}

export function safelyDetachRef(current: FiberNode) {
	const ref = current.ref;
	if (ref !== null) {
		if (typeof ref === 'function') {
			ref(null);
		}
	} else {
		ref.current = null;
	}
}

export const commitMutationEffects = commitEffects(
	'mutation',
	MutationMask | PassiveMask,
	commitMutationEffectsOnFiber
);

export const commitLayoutEffects = commitEffects(
	'layout',
	LayoutMask,
	commitLayoutEffectsOnFiber
);

function commitPassiveEffect(
	fiber: FiberNode,
	root: FiberRootNode,
	type: keyof PendingPassiveEffects
) {
	// unmount update
	if (
		fiber.tag !== FunctionComponent ||
		(type === 'update' && (fiber.flags & PassiveEffect) === NoFlags)
	) {
		return;
	}

	const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
	if (updateQueue !== null) {
		if (updateQueue.lastEffect === null && __DEV__) {
			console.error('当FC存在PassiveEffect flag时，不应该不存在effect');
		}
		if (updateQueue.lastEffect) {
			root.pendingPassiveEffects[type].push(updateQueue.lastEffect);
		}
	}
}

export const commitHookEffectList = (
	flags: Flags,
	lastEffect: Effect,
	callback: (effect: Effect) => void
) => {
	let effect = lastEffect.next as Effect;

	do {
		if ((effect.tag & flags) === flags) {
			callback(effect);
		}
		effect = effect.next as Effect;
	} while (effect !== lastEffect.next);
};

export const commitHookEffectListUnmount = (
	flags: Flags,
	lastEffect: Effect
) => {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const destroy = effect.destroy;
		if (typeof destroy === 'function') {
			destroy();
		}
		effect.tag &= ~HookHasEffect;
	});
};

export const commitHookEffectListDestroy = (
	flags: Flags,
	lastEffect: Effect
) => {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const destroy = effect.destroy;
		if (typeof destroy === 'function') {
			destroy();
		}
	});
};

export const commitHookEffectListCreate = (
	flags: Flags,
	lastEffect: Effect
) => {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const create = effect.create;
		if (typeof create === 'function') {
			effect.destroy = create();
		}
	});
};
export const commitNestedComponent = (
	root: FiberNode,
	onCommitUnmount: (fiber: FiberNode) => void
) => {
	let node = root;

	while (true) {
		onCommitUnmount(node);

		if (node.child !== null) {
			node.child.return = node;
			node = node.child;
			continue;
		}

		if (node === root) {
			return;
		}

		while (node.sibling === null) {
			if (node.return === null || node.return === root) {
				return;
			}

			node = node.return;
		}

		node.sibling.return = node.return;
		node = node.sibling;
	}
};

function recordHostChildrenToDelete(
	childrenToDelete: FiberNode[],
	unmountFiber: FiberNode
) {
	// 找到第一个root host节点
	let lastOne = childrenToDelete[childrenToDelete.length - 1];
	if (!lastOne) {
		childrenToDelete.push(unmountFiber);
	} else {
		let node = lastOne.sibling;
		while (node !== null) {
			if (unmountFiber === node) {
				childrenToDelete.push(unmountFiber);
			}
			node = node.sibling;
		}
	}
	// 每找到一个host节点,判断下这个节点是不是1 找到那个节点的兄弟节点
}

export const commitDeletion = (
	childToDelete: FiberNode,
	root: FiberRootNode
) => {
	const rootChildrenToDelete: FiberNode[] = [];

	commitNestedComponent(childToDelete, (unmountFiber) => {
		switch (unmountFiber.tag) {
			case HostCompoment:
				recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
				//TODO 解绑ref
				safelyDetachRef(unmountFiber);
				return;
			case HostText:
				recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
				return;
			case FunctionComponent:
				// useEffect unmount处理
				commitPassiveEffect(unmountFiber, root, 'unmount');
				return;
			default:
				if (__DEV__) {
					console.warn('未处理unmount类型', unmountFiber);
				}
		}
	});

	if (rootChildrenToDelete) {
		const hostParent = getHostParent(childToDelete);
		if (hostParent) {
			rootChildrenToDelete.forEach((node) => {
				removeChild(node.stateNode, hostParent);
			});
		}

		childToDelete.return = null;
		childToDelete.child = null;
	}
};

export const commitPlacement = (finishedWork: FiberNode) => {
	// 根据dom寻找parent节点
	if (__DEV__) {
		console.warn('执行Placement操作', finishedWork);
	}

	const hostParent = getHostParent(finishedWork);
	const sibling = getHostSibling(finishedWork);

	if (hostParent !== null) {
		insetOrAppendPlacementNodeIntoContainer(finishedWork, hostParent, sibling);
	}
};

function getHostSibling(fiber: FiberNode) {
	let node: FiberNode = fiber;

	findSibling: while (true) {
		// 向上寻找
		while (node.sibling === null) {
			const parent = node.return;

			if (
				parent === null ||
				node.tag === HostCompoment ||
				node.tag === HostRoot
			) {
				return null;
			}

			node = parent;
		}

		node.sibling.return = node.return;
		node = node.sibling;

		while (node.tag !== HostText && node.tag !== HostCompoment) {
			// 向下寻找
			if ((node.flags & Placement) !== NoFlags) {
				continue findSibling;
			}

			if (node.child === null) {
				continue findSibling;
			} else {
				node.child.return = node;
				node = node.child;
			}
		}

		if ((node.flags & Placement) === NoFlags) {
			return node.stateNode;
		}
	}
}

export const getHostParent = (fiber: FiberNode): Container | null => {
	let parent = fiber.return;
	while (parent) {
		const parentTag = parent.tag;

		if (parentTag === HostCompoment) {
			return parent.stateNode;
		}

		if (parentTag === HostRoot) {
			return (parent.stateNode as FiberRootNode).container;
		}

		parent = parent.return;
	}

	if (__DEV__) {
		console.warn('未找到host parent', parent);
	}
	return null;
};

export const insetOrAppendPlacementNodeIntoContainer = (
	finishedWork: FiberNode,
	hostParent: Container,
	before?: Instance
) => {
	if (finishedWork.tag === HostCompoment || finishedWork.tag === HostText) {
		if (before) {
			insertChildToContainer(finishedWork.stateNode, hostParent, before);
		} else {
			appendChildToContainer(hostParent, finishedWork.stateNode);
		}

		return;
	}

	const child = finishedWork.child;
	if (child !== null) {
		insetOrAppendPlacementNodeIntoContainer(child, hostParent);
		let sibling = child.sibling;

		while (sibling !== null) {
			insetOrAppendPlacementNodeIntoContainer(sibling, hostParent);
			sibling = sibling.sibling;
		}
	}
};
