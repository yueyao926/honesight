// Run with Node 22.18+: node --test tests/shareUrl.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { shareUrl } from "../src/utils/shareUrl.ts";

test("sharing handles missing APIs, denied permissions, cancellation and copy failure", async (t) => {
  const url = "http://example.test/community/post/42";
  for (const scenario of [
    { name: "native share", share: "success", expected: "shared" },
    { name: "cancel native share", share: "cancel", expected: "cancelled" },
    { name: "clipboard", clipboard: "success", expected: "copied" },
    { name: "native share denied", share: "denied", clipboard: "success", expected: "copied" },
    { name: "HTTP without either API", legacy: true, expected: "copied" },
    { name: "clipboard denied", clipboard: "denied", legacy: true, expected: "copied" },
    { name: "copy returns false", legacy: false, expected: "manual" },
    { name: "copy throws", legacy: "throws", expected: "manual" },
    { name: "copy API missing", expected: "manual" },
  ]) {
    await t.test(scenario.name, async () => {
      let removed = false;
      let restored = false;
      let appended = false;
      let selected = false;
      const input = { style: {}, select() { selected = true; }, remove() { removed = true; } };
      class Element { focus() { restored = true; } }
      // Restore browser globals after each case, including Node's own navigator.
      const originals = new Map(["navigator", "document", "HTMLElement"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
      const navigator = {};
      if (scenario.share) navigator.share = async (data) => {
        assert.deepEqual(data, { title: "Test post", url });
        if (scenario.share !== "success") throw new DOMException("share failed", scenario.share === "cancel" ? "AbortError" : "NotAllowedError");
      };
      if (scenario.clipboard) navigator.clipboard = { async writeText(text) {
        assert.equal(text, url);
        if (scenario.clipboard === "denied") throw new DOMException("denied", "NotAllowedError");
      } };
      const document = {
        activeElement: new Element(),
        createElement(tag) { assert.equal(tag, "textarea"); return input; },
        body: { appendChild(node) { assert.equal(node.value, url); appended = true; } },
      };
      if ("legacy" in scenario) document.execCommand = (command) => {
        assert.equal(command, "copy");
        assert.ok(selected);
        if (scenario.legacy === "throws") throw new Error("copy failed");
        return scenario.legacy;
      };
      try {
        for (const [key, value] of Object.entries({ navigator, document, HTMLElement: Element })) {
          Object.defineProperty(globalThis, key, { configurable: true, value });
        }
        assert.equal(await shareUrl("Test post", url), scenario.expected);
        const usesLegacy = !["shared", "cancelled"].includes(scenario.expected) && scenario.clipboard !== "success";
        assert.equal(appended, usesLegacy);
        assert.equal(removed, usesLegacy);
        assert.equal(restored, usesLegacy);
      } finally {
        for (const [key, descriptor] of originals) {
          if (descriptor) Object.defineProperty(globalThis, key, descriptor);
          else delete globalThis[key];
        }
      }
    });
  }
});
