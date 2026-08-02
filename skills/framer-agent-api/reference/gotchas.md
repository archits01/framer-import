# Gotchas & workarounds (the stuff that wastes hours)

Each of these is a real failure mode not covered by the base docs. When an edit
"silently doesn't work," check here first.

## 1. Clearing a control: empty string does NOT clear it — use `"null"`

Setting a control to `""` leaves the old value in place. The sentinel string
`"null"` clears it (becomes `undefined`).

```js
// ❌ does nothing:
await framer.agent.applyChanges('SET <id> $control__link=""', { pagePath: "/" });
// ✅ clears the value:
await framer.agent.applyChanges('SET <id> $control__link="null"', { pagePath: "/" });
```

Same pattern to strip a text-style preset: `textStylePreset="null"`.

## 2. Rich-text virtual children go stale between exec calls

Rich text exposes virtual child ids like `v:<rtId>:0` (TextBlock) and
`v:<rtId>:0:0` (TextRun). These are regenerated and **go stale across separate
`exec` invocations**. If you read a RichTextNode in one call and try to `SET` /
`+TextRun` its virtual child in a later call, you get
*"Virtual rich text child no longer exists."*

**Fix:** fresh-read the owning `RichTextNode` with `getNode` in the **same
`exec`** immediately before editing its runs. Do the read and the write in one
script.

## 3. Component variants & replicas — propagation direction

- Editing the **primary** instance propagates to its replicas.
- Editing a **replica** does **not** propagate upward, and a bare `SET` on a
  replica may be ignored if the value is inherited from a primary elsewhere.
- To force a replica-specific value, address it by its **ground-node-prefixed
  id** (`<variantGroundId><slotId>`). To hide something only in certain
  variants: `SET <variantGroundId><slotId> visible="false"`.

When you add/edit children in one variant of a repeated component and they
"leak" into sibling variants, that's replica propagation — target per-variant
(and hide rather than delete, since delete hits all variants).

## 4. Editing an invisible component-definition variant does nothing on the page

If `getAncestors` shows a **`ComponentNode`** ancestor (not the page root), the
node lives inside the component **definition**, in a variant that may not be the
one rendered on the page. A `SET` there won't change the live site, and a
page-scoped scan (`getNode` on the page root) will show **zero** occurrences of
the old value even though the node still exists in the definition.

**Decision rule:** scan the actual page render tree. If the user-visible count is
0, you're done — don't chase a leftover copy buried in an unused variant.

## 5. Strikethrough is ignored while a text-style preset is set

Run-level `textDecoration="line-through"` is silently dropped when the run has a
text-style preset ("Inline styles are ignored while a text style preset is
set"). Workaround, in this order:

1. `textStylePreset="null"` (strip the preset)
2. set the font inline (family, weight, size, line-height)
3. **then** `textDecoration="line-through"` sticks.

(In a code component, just use CSS `textDecoration: "line-through"` — this only
bites native canvas rich text.)

## 6. New `+FrameNode` defaults to a fixed 100px height

Every freshly created frame is 100px tall and fixed. Follow creation with
`SET <newId> height="auto"` (and `width="auto"` if it should hug content) or your
layout collapses/overflows.

## 7. Screenshots render stale — verify against node data

`readProject([{type:"screenshot", id}])` (and on-demand screenshots generally)
frequently return a **cached** render that doesn't reflect your last edit. Never
confirm success from a screenshot. Re-`getNode` the specific attribute you
changed and assert on that.

## 8. `getRect` origin artifacts can make centered things look off-center

Rect coordinates are relative to an origin that isn't always the visual frame,
so an x-value can look "off-center" when the element is actually fine. Don't
"fix" centering based on raw rect numbers alone — cross-check visually and
against the layout attributes.

## 9. `framer.agent.typeCheckCodeFile` is not exposed

You can create/edit code files but there's no exposed type-check method through
the agent. Keep code components simple and self-contained; test behavior on the
canvas instead of relying on a type-check round-trip.

## 10. `uploadImage({ bytes })` fails cross-realm — use a base64 data URL

The `{ bytes }` form throws across the sandbox boundary. Pass a data URL string:

```js
const asset = await framer.uploadImage({
  image: "data:image/png;base64,<...>",
  name: "asset-name",
  altText: "description",
});
// use asset.url (a plain string)
```

## 11. CMS quirks

- `collection.addItems([{ id, fieldData }])` **updates** an existing item by id;
  a **new** item requires a `slug`.
- An **image field value is a URL string**, not an object.
- **Date fields** don't display by default when placed on canvas — bind via a
  `ComputedValue` with a `toDateString` transform (see `recipes.md`). Otherwise
  every row shows the same literal placeholder date.

## 12. Array property controls need a `defaultValue` to populate instances

A code component's `ControlType.Array` control won't fill new instances unless
the control declares a `defaultValue`. If you change the default **after**
instances exist, **recreate the instance** to pick up the new default — existing
instances keep their old baked-in values (the classic "the component's default
has N items but the placed instance still shows the old fewer items" symptom).
