# The `applyChanges` DSL

`framer.agent.applyChanges(commandString, { pagePath })` applies one or more
operations to the project tree. Commands are newline-separated. The `pagePath`
option scopes the change to a page (e.g. `"/"`, `"/pricing"`); omit it for
component-definition / project-global edits.

```js
await framer.agent.applyChanges(
  'SET <id1> width="auto" height="auto"\nSET <id2> $control__text="Hello"',
  { pagePath: "/" }
);
```

## Operations

### `SET <id> attr="value" [attr2="value" ...]`
Set one or more attributes on a node. Values are always double-quoted strings,
even numbers/booleans (`height="auto"`, `visible="false"`, `$control__value="99"`).

- Plain node attributes: `width`, `height`, `visible`, `position`, `textColor`,
  `backgroundColor`, `radius`, etc.
- Component instance controls are prefixed `$control__`:
  `$control__text`, `$control__link`, `$control__variant`,
  `$control__newTab`, `$control__value`, `$control__title`, `$control__iconPosition`.
  (Exact control names vary per component — read the instance to discover them.)
- Nested/array control paths use dots and indices:
  `$control__text.from="var(--variable-<fieldId>)"`,
  `$control__text.transforms.0.name="toDateString"`,
  `$control__text.transforms.0.display="date"`.

### `DEL <id>`
Delete a node and its subtree.

### `MOVE <id> <newParentId>`
Reparent a node.

### `DUPE <id>`
Duplicate a node in place.

### Node creation: `+<NodeType> <parentId> [attr="value" ...]`
Creates a child under `parentId`. Types seen in practice:

- `+FrameNode` — a layout frame. **Defaults to a fixed 100px height** — almost
  always follow with `height="auto"` (see gotchas).
- `+RichTextNode` — a text block; add `+TextRun` children for the actual text.
- `+TextRun` — an inline run of text (`text="..."`) inside a rich-text block.
- `+IconNode` — an icon.
- `+ComponentInstanceNode` — an instance of a component; set its `$control__*`.

Newly created nodes get generated ids; read the parent back to discover them,
or capture the return value of `applyChanges` if it reports created ids.

## Node ids, ground nodes, and scopes

Reading a node returns useful lineage fields:

- `id` — the stable id you address in the DSL.
- `$parentId` — immediate parent.
- `$groundNodeId` — the "ground" (base) node for a component instance/replica.
- `$scopeId` — the enclosing component/page scope.

**Replica ids are composed:** `<groundNodeId><suffix>`. Two instances of the
same slot in different replicas of a component share the **suffix** but have
different ground-node prefixes. To target a specific replica when a bare `SET`
won't stick, prefix the slot id with **that replica's ground-node id**:

```
SET <variantGroundId><slotId> visible="false"
```

This is the general fix for "I edited/added a child in one variant of a
repeated component and it changed (or leaked into) the others." Address each
variant by its own ground-node-prefixed id instead of relying on a bare id, and
hide-per-variant rather than delete (delete hits every variant).

## In-place text replacement

For copy changes that don't restructure the tree, prefer:

```js
await framer.agent.replaceText(
  { id: "<richTextNodeId>", searchText: "old text", replaceText: "new text" },
  { pagePath: "/" }
);
```

- Target the **owning `RichTextNode` id** (not a virtual child id).
- `searchText` must match the current text exactly; if it doesn't match,
  nothing changes and no error is thrown — so verify by re-reading.
- For component instances whose label is a control, use
  `SET <id> $control__text="..."` instead — `replaceText` won't touch controls.

## Reading the tree — method cheat sheet

- `getNode({id}, {pagePath})` — one node + its serialized subtree.
- `getNodes`, `getNodesOfTypes`, `getDescendantsOfTypes`,
  `getDescendantReferencesOfTypes` — bulk / typed reads.
- `getAncestors({id})`, `getParentNode`, `getScopeNode`, `getGroundNode` —
  lineage. Use ancestors to tell whether a node lives on the live page render
  tree or inside a component **definition** (a `ComponentNode` ancestor →
  it's a variant that may never render; see gotchas).
- `getRect({id})` — geometry (watch for coordinate-origin artifacts).
- `serialize` / `serializeNodes` — full serialized form.
- `readProject([{ type: "screenshot", id }])` — returns an `image_url` for a
  node. Treat as a hint, not ground truth.
