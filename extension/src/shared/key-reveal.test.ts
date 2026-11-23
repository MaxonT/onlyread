// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { lockedForReveal, mountKeyReveal, type KeyReveal } from './key-reveal';
import type { SettingsLock } from './types';

const open: SettingsLock = { agent: false, pinSet: false, pinUnlocked: false };

let key: HTMLInputElement;
let button: HTMLButtonElement;
let reveal: KeyReveal;

/** A person typing: the value is set, then the input event the browser fires. */
function type(value: string): void { key.value = value; key.dispatchEvent(new Event('input')); }
/** Undo or redo, as the browser reports it. */
function undo(value: string): void { key.value = value; key.dispatchEvent(new InputEvent('input', { inputType: 'historyUndo' })); }
const shown = () => key.type === 'text';

beforeEach(() => {
  document.body.innerHTML = '<input id="k" type="password"><button id="b" type="button" disabled></button>';
  key = document.getElementById('k') as HTMLInputElement;
  button = document.getElementById('b') as HTMLButtonElement;
  reveal = mountKeyReveal(key, button);
});

describe('lockedForReveal', () => {
  it('is locked while the lock is unknown, for an agent, an agent browser, and a PIN not entered', () => {
    expect(lockedForReveal(undefined)).toBe(true);
    expect(lockedForReveal({ ...open, agent: true })).toBe(true);
    expect(lockedForReveal({ ...open, agentBrowser: true })).toBe(true);
    expect(lockedForReveal({ ...open, pinSet: true, pinUnlocked: false })).toBe(true);
    expect(lockedForReveal(open)).toBe(false);
    expect(lockedForReveal({ ...open, pinSet: true, pinUnlocked: true })).toBe(false);
  });
});

describe('the show/hide button', () => {
  it('stays disabled until the lock is known', () => {
    reveal.loaded(undefined);
    type('dummy-key-123');
    expect(button.disabled).toBe(true);
    reveal.setLock(open);
    expect(button.disabled).toBe(false);
  });

  it('shows and hides a key typed in this visit, with its label and aria-pressed', () => {
    reveal.loaded(undefined);
    reveal.setLock(open);
    type('dummy-key-123');
    expect(button.getAttribute('aria-label')).toBe('Show key');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    button.click();
    expect(shown()).toBe(true);
    expect(button.getAttribute('aria-label')).toBe('Hide key');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    button.click();
    expect(shown()).toBe(false);
    expect(button.getAttribute('aria-label')).toBe('Show key');
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('is a real button, so Enter and Space activate it like a click', () => {
    expect(button.tagName).toBe('BUTTON');
    expect(button.type).toBe('button');
  });

  it('stays disabled while the field holds the stored key', () => {
    key.value = 'dummy-saved-key';
    reveal.loaded('dummy-saved-key');
    reveal.setLock(open);
    expect(button.disabled).toBe(true);
    button.click();
    expect(shown()).toBe(false);
  });

  it('a partial edit of the stored key does not make it revealable', () => {
    key.value = 'dummy-saved-key';
    reveal.loaded('dummy-saved-key');
    reveal.setLock(open);
    type('dummy-saved-ke'); // delete the last character
    expect(button.disabled).toBe(true);
    type('dummy-saved-ke-x'); // type more
    expect(button.disabled).toBe(true);
    expect(shown()).toBe(false);
  });

  it('undoing the emptying brings the stored key back, and it is not revealable', () => {
    key.value = 'dummy-saved-key';
    reveal.loaded('dummy-saved-key');
    reveal.setLock(open);
    type('');
    expect(button.disabled).toBe(false);
    undo('dummy-saved-key');
    expect(button.disabled).toBe(true);
    // also a piece of it, after an edit and then an emptying
    type('dummy-saved-ke');
    type('');
    undo('dummy-saved-ke');
    expect(button.disabled).toBe(true);
    expect(shown()).toBe(false);
  });

  it('undo back to an empty field leaves it usable for a new key', () => {
    key.value = 'dummy-saved-key';
    reveal.loaded('dummy-saved-key');
    reveal.setLock(open);
    type('x');
    undo('');
    expect(button.disabled).toBe(false);
  });

  it('typing the stored value back by hand is the stored key again', () => {
    key.value = 'dummy-saved-key';
    reveal.loaded('dummy-saved-key');
    reveal.setLock(open);
    type('');
    type('dummy-saved-key');
    expect(button.disabled).toBe(true);
  });

  it('works without a button on the page', () => {
    document.body.innerHTML = '<input id="k2" type="password">';
    const k2 = document.getElementById('k2') as HTMLInputElement;
    const r = mountKeyReveal(k2, null);
    r.loaded('dummy-saved-key');
    r.setLock(open);
    r.hide();
    expect(k2.type).toBe('password');
  });

  it('a value typed after emptying the field is fresh and can be shown', () => {
    key.value = 'dummy-saved-key';
    reveal.loaded('dummy-saved-key');
    reveal.setLock(open);
    type('');
    type('dummy-new-key');
    expect(button.disabled).toBe(false);
    button.click();
    expect(shown()).toBe(true);
  });

  it('a provider change (the field filled again) hides it, and a stored key is not revealable', () => {
    reveal.loaded(undefined);
    reveal.setLock(open);
    type('dummy-key-123');
    button.click();
    expect(shown()).toBe(true);
    key.value = 'dummy-other-saved';
    reveal.loaded('dummy-other-saved');
    expect(shown()).toBe(false);
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('a provider with no stored key gives an empty field that can be typed in and shown', () => {
    key.value = '';
    reveal.loaded(undefined);
    reveal.setLock(open);
    type('dummy-key-123');
    button.click();
    expect(shown()).toBe(true);
  });

  it('hide() puts it back (Save and test, passed or failed) and keeps the typed value', () => {
    reveal.loaded(undefined);
    reveal.setLock(open);
    type('dummy-key-123');
    button.click();
    reveal.hide();
    expect(shown()).toBe(false);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(key.value).toBe('dummy-key-123');
    expect(button.disabled).toBe(false);
  });

  it.each([
    ['an agent working', { ...open, agent: true }],
    ['an agent browser', { ...open, agentBrowser: true }],
    ['a PIN set and not entered', { ...open, pinSet: true, pinUnlocked: false }],
  ])('is disabled for %s, and hides a key already shown the moment the lock appears', (_name, lock) => {
    reveal.loaded(undefined);
    reveal.setLock(open);
    type('dummy-key-123');
    button.click();
    expect(shown()).toBe(true);
    reveal.setLock(lock);
    expect(shown()).toBe(false);
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    button.click();
    expect(shown()).toBe(false);
    reveal.setLock(open); // the lock ends: usable again, still hidden
    expect(button.disabled).toBe(false);
    expect(shown()).toBe(false);
  });

  it('works again once the PIN is entered', () => {
    reveal.loaded(undefined);
    reveal.setLock({ ...open, pinSet: true, pinUnlocked: false });
    type('dummy-key-123');
    expect(button.disabled).toBe(true);
    reveal.setLock({ ...open, pinSet: true, pinUnlocked: true });
    expect(button.disabled).toBe(false);
  });
});
