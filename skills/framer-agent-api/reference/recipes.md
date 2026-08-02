# Recipes — bigger building blocks

## Images: upload and use

```js
// Prepare bytes however you like, then upload as a base64 data URL (NOT {bytes}).
const asset = await framer.uploadImage({
  image: "data:image/png;base64,<base64>",
  name: "asset-name",
  altText: "description",
});
// asset.url is a plain string — use it directly as an image field / background.
await framer.agent.applyChanges(
  `SET <imageNodeId> backgroundImage="${asset.url}"`,
  { pagePath: "/" }
);
```

### Local image prep before upload

The sandbox can read/write `cwd`, `/tmp`, and `os.tmpdir()`. Common prep steps
(e.g. with Pillow if available) that make assets drop in cleanly:

- **Trim transparent margins:** open RGBA, `img.getbbox()` on the alpha, crop.
- **Recolor to a brand color:** iterate pixels, replace opaque pixels with the
  target RGB while preserving alpha.
- **Crop to content:** compute the alpha bounding box and crop to it.

Save to `/tmp`, then base64 it into `uploadImage`.

## CMS collections

```js
const collections = await framer.getCollections();      // cache in state
const col = collections.find(c => c.name === "<Collection Name>");
const fields = await col.getFields();                   // discover field IDs

// UPDATE existing items by id:
await col.addItems([
  { id: "<existingItemId>", fieldData: { "<fieldId>": value } },
]);

// NEW items must include a slug; image fields take a URL STRING:
await col.addItems([
  { slug: "<unique-slug>", fieldData: {
      "<textFieldId>": "Some title",
      "<imageFieldId>": asset.url,          // string, not { url }
  }},
]);
```

### Binding a date field on the canvas (`toDateString`)

A CMS date field placed on canvas renders blank until you bind it as a computed
value with a date transform:

```js
await framer.agent.applyChanges([
  `SET <dateNodeId>`,
  `  $control__text.from="var(--variable-<dateFieldId>)"`,
  `  $control__text.transforms.0.name="toDateString"`,
  `  $control__text.transforms.0.display="date"`,
].join(" "), { pagePath: "/<page>" });
```

Without this, every row shows the same literal placeholder date.

## Code components

```js
// create
const file = await framer.createCodeFile("<Name>.tsx", sourceString);
// edit later
const existing = await framer.getCodeFile(fileId);
await existing.setFileContent(newSourceString);
```

- Property controls via `addPropertyControls(Component, { ... })`.
- Array controls **must** declare `defaultValue` or instances stay empty.
- No exposed `typeCheckCodeFile` — verify behavior on the canvas.
- After changing an array control's `defaultValue`, **recreate the instance** so
  it picks up the new default (old instances keep baked-in values).
- Standard React component conventions apply, plus Framer layout annotations:
  ```tsx
  /**
   * @framerSupportedLayoutWidth any-prefer-fixed
   * @framerSupportedLayoutHeight auto
   * @framerSupportsDOMRef true
   */
  ```

## Animated-number components with a hidden text fallback

Some template components (e.g. an animated number/`NumberFlow`-style component)
animate a numeric `$control__value`, and templates often place a **hidden text
fallback** (e.g. "Free" / "Custom") right next to it: whichever of the two is
**visible** is what the user actually sees.

- A numeric value shown = the number component visible, the text fallback hidden.
- A non-numeric label shown = the **text fallback** visible, the number hidden
  (its `$control__value` may still hold a stale number — harmless because it's
  not rendered, but zero it out if you want it clean).

When auditing displayed values, check **which of the pair is visible**, not just
the number component's `$control__value`.

## Publishing

```js
await framer.agent.publish(/* preview or production per the API */);
```

Offer a **preview** publish first. If a command prints `[FRAMER_BRANCH_CHANGE]`,
tell the user the branch changed and surface the returned `url`; rename an
auto-generated `adjective-noun` branch to something task-descriptive with
`renameBranch`.
