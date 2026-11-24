import assert from "node:assert/strict";
import { test } from "node:test";
import { RESIDENT_COPY as COPY, WIZARD_COPY } from "../../src/residents/copy.ts";
import { residentForm } from "../../src/residents/create-form.ts";

// Component layer: the real Create panel with a hand-made DOM and a stub builder. Timers are fake.
// LFT-063: after "Not yet", a second submit must open a fresh 600 ms window for "Use 1 ticket".

const ARM_MS = 600; // the wait the spec names: Use 1 ticket ignores taps this long after the question opens
const NO_AT = 100;
const RESUBMIT_AT = 200;
const FIRST_ARM_AT = ARM_MS; // the first question's timer would fire here
const SECOND_ARM_AT = RESUBMIT_AT + ARM_MS;

const focused: unknown[] = [];

class El extends EventTarget {
  tagName: string;
  children: El[];
  classes: Set<string>;
  attributes: Map<string, string>;
  dataset: Record<string, string>;
  textContent: string | null;
  hidden: boolean;
  disabled: boolean;
  tabIndex: number;
  className: string;
  id: string;
  type: string;
  title: string;
  src: string;
  alt: string;
  draggable: boolean;
  value: string;
  classList: { add(...names: string[]): void; remove(...names: string[]): void; toggle(name: string, force?: boolean): boolean; contains(name: string): boolean };

  constructor(tag: string) {
    super();
    this.tagName = tag;
    this.children = [];
    this.classes = new Set();
    this.attributes = new Map();
    this.dataset = {};
    this.textContent = "";
    this.hidden = false;
    this.disabled = false;
    this.tabIndex = 0;
    this.className = "";
    this.id = "";
    this.type = "";
    this.title = "";
    this.src = "";
    this.alt = "";
    this.draggable = false;
    this.value = "";
    this.classList = {
      add: (...names) => { for (const name of names) this.classes.add(name); },
      remove: (...names) => { for (const name of names) this.classes.delete(name); },
      toggle: (name, force) => {
        const on = force ?? !this.classes.has(name);
        if (on) this.classes.add(name); else this.classes.delete(name);
        return on;
      },
      contains: (name) => this.classes.has(name),
    };
  }
  append(...nodes: El[]) { this.children.push(...nodes); }
  prepend(...nodes: El[]) { this.children.unshift(...nodes); }
  replaceChildren(...nodes: El[]) { this.children = [...nodes]; }
  setAttribute(name: string, value: string) { this.attributes.set(name, String(value)); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  removeAttribute(name: string) { this.attributes.delete(name); }
  focus() { focused.push(this); }
  blur() {}
  closest(_selector?: string): unknown { return null; }
  matches() { return false; }
  querySelectorAll() { return []; }
  getClientRects() { return []; }
}

function find(node: El, text: string): El | undefined {
  if (node.textContent === text) return node;
  for (const child of node.children) {
    const hit = find(child, text);
    if (hit) return hit;
  }
  return undefined;
}

function findBy(node: El, test: (node: El) => boolean): El | undefined {
  if (test(node)) return node;
  for (const child of node.children) {
    const hit = findBy(child, test);
    if (hit) return hit;
  }
  return undefined;
}

function fixture(t: { after(fn: () => void): void }, mode = "mock", overrides: Record<string, unknown> = {}, direct = false) {
  const body = new El("body");
  const doc = { body, createElement: (tag: string) => new El(tag), createElementNS: (_ns: string, tag: string) => new El(tag) };
  const saved = { document: Reflect.get(globalThis, "document"), matchMedia: Reflect.get(globalThis, "matchMedia") };
  Reflect.set(globalThis, "document", doc);
  Reflect.set(globalThis, "matchMedia", () => ({ matches: false }));
  t.after(() => {
    Reflect.set(globalThis, "document", saved.document);
    Reflect.set(globalThis, "matchMedia", saved.matchMedia);
  });
  focused.length = 0;
  const state: Record<string, unknown> = {
    status: "idle", error: null, saving: false, stage: "idle", tickets: 2,
    selections: { creature: null, personality: null, signatureDetail: null, palette: null }, ...overrides,
  };
  const selects: unknown[][] = [];
  const calls: string[] = [];
  const builder = { state: () => state, select: (...args: unknown[]) => { selects.push(args); }, create() {
    calls.push("create"); state.status = "generating"; update();
  } };
  const { form, update, dispose, dismissProgress } = residentForm(builder as never, mode as never, undefined, () => {}, undefined, direct);
  const submit = () => form.dispatchEvent(new Event("submit", { cancelable: true }));
  const click = (label: string) => {
    const button = find(form as unknown as El, label);
    assert.ok(button, `no button labelled ${label}`);
    button.dispatchEvent(new Event("click"));
  };
  const yes = () => {
    const button = find(form as unknown as El, COPY.confirmYes);
    assert.ok(button, "Use 1 ticket is not rendered");
    return button;
  };
  const shows = (label: string) => find(form as unknown as El, label) !== undefined;
  // The first card of a question's grid; the grid fills only while that question is showing.
  const card = (field: string) => {
    const grid = findBy(form as unknown as El, node => node.dataset.field === field);
    const first = grid?.children.find(child => child.className === "wizard-card");
    assert.ok(first, `no card for ${field}`);
    return first;
  };
  const tap = (button: El) => button.dispatchEvent(new Event("click"));
  return { submit, click, yes, shows, state, update, dispose, dismissProgress, selects, card, tap, calls, form: form as unknown as El };
}

test("#682 public summary submits directly and shows generating before a second submit", (t) => {
  const fx = fixture(t, "online", {}, true);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const surprise = findBy(fx.form, node => node.classes.has("wizard-dice"));
  assert.ok(surprise);
  for (const _part of WIZARD_COPY.parts) {
    fx.tap(surprise);
    t.mock.timers.runAll();
  }
  assert.equal(fx.shows("Create · 1 ticket"), true);
  fx.submit(); fx.submit();
  assert.deepEqual(fx.calls, ["create"]);
  assert.equal(fx.form.dataset.phase, "creating");
});

test("#682 a restored reconnect can be submitted without rebuilding the design", (t) => {
  const fx = fixture(t, "online", { status: "failed", error: { kind: "network", message: "Disconnected." }, tickets: 0, resumable: true }, true);
  fx.submit();
  assert.deepEqual(fx.calls, ["create"]);
  assert.deepEqual(fx.selects, []);
});

test("#682 a disconnected online build without observation cannot charge another ticket from its summary", (t) => {
  const fx = fixture(t, "online", { status: "failed", error: { kind: "network", message: "Disconnected." }, tickets: 2, resumable: false }, true);
  const make = find(fx.form, "Create · 1 ticket");
  assert.equal(make?.hidden, true);
  fx.submit();
  assert.deepEqual(fx.calls, []);
});
