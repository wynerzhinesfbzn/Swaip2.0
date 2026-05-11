/**
 * Global hardware/browser back-button handler.
 * Stack-based: only the TOPMOST registered handler fires.
 * When the stack is empty, back press does nothing (stays in app).
 */
import { useEffect, useRef } from 'react';

const _stack: Array<{ id: symbol; fn: () => void }> = [];
let _ready = false;

export function initBackHandler() {
  if (_ready) return;
  _ready = true;

  /* Replace the current history entry with a tagged one so we always
     have "somewhere" to go back to inside the browser history. */
  window.history.replaceState({ swaip: true, root: true }, '');
  /* Push one sentinel entry so the first real "back" press hits popstate. */
  window.history.pushState({ swaip: true }, '');

  window.addEventListener('popstate', () => {
    const top = _stack[_stack.length - 1];
    if (top) {
      /* Re-push so we always have an entry above the root. */
      window.history.pushState({ swaip: true }, '');
      top.fn();
    } else {
      /* Stack is empty — stay inside the app, do nothing visible.
         Re-push so the next "back" also stays inside. */
      window.history.pushState({ swaip: true }, '');
    }
  });
}

/**
 * Register a back handler for the current component.
 * Pass `null` to unregister (component "hides" its handler).
 *
 * Rules:
 * - When onBack transitions null→fn  → pushes a history entry, registers handler.
 * - When onBack transitions fn→null  → removes handler (no history pop needed;
 *   the next real-user back press will hit a higher entry or the sentinel).
 * - Always uses the LATEST fn via ref, so you can pass inline lambdas safely.
 */
export function useBackHandler(onBack: (() => void) | null) {
  const idRef  = useRef<symbol>(Symbol());
  const fnRef  = useRef(onBack);
  fnRef.current = onBack;            // always up-to-date

  useEffect(() => {
    initBackHandler();
    if (!onBack) return;

    const id = idRef.current;
    const fn = () => fnRef.current?.();

    window.history.pushState({ swaip: true }, '');
    _stack.push({ id, fn });

    return () => {
      const idx = _stack.findIndex(e => e.id === id);
      if (idx !== -1) _stack.splice(idx, 1);
    };
  // Re-run only when the handler switches between "active" and "absent".
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!onBack]);
}
