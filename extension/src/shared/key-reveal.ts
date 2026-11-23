// The eye button on the API key field (shared by the settings page and the first-run window). The key protects the
// person's AI judge, so the button shows only what was typed during this visit: never a key the form filled in from
// storage, and never while the settings are locked.
import type { SettingsLock } from './types';

export interface KeyReveal {
  /** The field was just filled: `saved` is the stored key it holds, if any (not revealable until the field is emptied). */
  loaded(saved: string | undefined): void;
  /** The settings lock as the background reports it; `undefined` until known. */
  setLock(lock: SettingsLock | undefined): void;
  /** Back to hidden (provider changed, Save and test). */
  hide(): void;
}

/** True when the lock keeps the key from being shown: an agent working, an agent's browser, or a PIN set and not entered. */
export function lockedForReveal(lock: SettingsLock | undefined): boolean {
  if (!lock) return true; // not known yet: treated as locked
  return lock.agent === true || lock.agentBrowser === true || (lock.pinSet === true && lock.pinUnlocked !== true);
}

export function mountKeyReveal(key: HTMLInputElement, button: HTMLButtonElement | null): KeyReveal {
  if (!button) return { loaded() {}, setLock() {}, hide() { key.type = 'password'; } }; // a page without the button
  // `fresh`: the field's content was typed during this visit. A stored key loaded into the field is not fresh, and an
  // edit of it does not make it so: only emptying the field first does, so the stored part never shows.
  let fresh = true;
  let storedKey: string | undefined; // what the form filled in from storage
  let lock: SettingsLock | undefined;

  const render = () => {
    const allowed = fresh && !lockedForReveal(lock);
    if (!allowed) key.type = 'password';
    const shown = key.type === 'text';
    button.disabled = !allowed;
    button.setAttribute('aria-pressed', String(shown));
    button.setAttribute('aria-label', shown ? 'Hide key' : 'Show key');
    button.title = shown ? 'Hide key' : 'Show key';
    button.classList.toggle('on', shown);
  };

  button.addEventListener('click', () => {
    if (button.disabled) return;
    key.type = key.type === 'text' ? 'password' : 'text';
    render();
  });
  key.addEventListener('input', (e) => {
    const undoRedo = typeof (e as InputEvent).inputType === 'string' && (e as InputEvent).inputType.startsWith('history');
    // Undo or redo can bring the stored key (or a piece of it) back into a field that was emptied: not fresh again.
    if (key.value === '') fresh = true;
    else if (storedKey && (undoRedo || key.value === storedKey)) fresh = false;
    render();
  });
  render();
  return {
    loaded(saved) { storedKey = saved || undefined; fresh = !storedKey; key.type = 'password'; render(); },
    setLock(next) { lock = next; render(); },
    hide() { key.type = 'password'; render(); },
  };
}
