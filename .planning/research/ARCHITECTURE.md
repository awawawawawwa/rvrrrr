# Architecture Research: TUI Rendering Engine (Ink Replacement with Rust Backend)

## Pipeline Overview

```
React Components
     │
     ▼
Custom Reconciler (react-reconciler)
     │
     ▼
Ink-style DOM Tree (DOMElement + TextNode)
     │
     ▼
Yoga Layout Calculation (yoga-layout WASM)
     │
     ▼
Tree Serialization → JSON Protocol
     │
     ▼  (stdin/stdout pipe or FFI)
Rust Renderer Binary
     │
     ▼
Double-buffered Cell Grid → Diff → ANSI Escape Codes
     │
     ▼
Terminal Output (stdout)
```

---

## 1. Ink's Internals

### Node Types

Ink defines four element names and one text name:

| Node Name          | Purpose                              | Has YogaNode? |
|--------------------|--------------------------------------|---------------|
| `ink-root`         | Root container, receives terminal width | Yes          |
| `ink-box`          | Layout container (like `<div>`)       | Yes          |
| `ink-text`         | Text container with measure function  | Yes          |
| `ink-virtual-text` | Nested text (like `<span>` inside `<Text>`) | No     |
| `#text`            | Raw text leaf node                    | No           |

### DOMElement Structure

```typescript
type DOMElement = {
  nodeName: ElementNames;
  attributes: Record<string, DOMNodeAttribute>;
  childNodes: DOMNode[];
  parentNode: DOMElement | undefined;
  yogaNode?: YogaNode;
  style: Styles;
  internal_transform?: OutputTransformer;
  internal_static?: boolean;
  isStaticDirty?: boolean;
  staticNode?: DOMElement;
  onComputeLayout?: () => void;
  onRender?: () => void;
  onImmediateRender?: () => void;
};

type TextNode = {
  nodeName: '#text';
  nodeValue: string;
  parentNode: DOMElement | undefined;
  yogaNode: undefined;
  style: Styles;
};
```

### Ink's Three-Stage Rendering Pipeline

**Stage 1 — Reconciliation:** The custom React reconciler processes component tree updates. React calls `createInstance`, `appendChild`, `commitUpdate`, etc. on the host config. These functions create/mutate DOMElement and TextNode objects, and mirror those changes into the parallel Yoga node tree.

**Stage 2 — Layout Calculation:** After the reconciler commits, `resetAfterCommit` fires `onComputeLayout`, which calls:
```typescript
rootNode.yogaNode.setWidth(terminalWidth);
rootNode.yogaNode.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
```
This computes absolute positions (left, top) and dimensions (width, height) for every node.

**Stage 3 — Output Rendering:** `renderer.ts` creates an `Output` object (a virtual 2D character grid sized to the root's computed dimensions). `renderNodeToOutput` walks the tree recursively:
- For `ink-box`: renders background color, borders, then recurses into children.
- For `ink-text`: squashes nested text/virtual-text nodes into a single string, wraps it to fit the computed width, writes to the grid at `(x, y)`.
- For `ink-root`: recurses into children.

The `Output.get()` method flattens the grid into a single string. Ink then diffs this against the previous frame's string (line-by-line) and writes only changed lines to stdout.

### Key Architectural Decisions in Ink

1. **Text must be wrapped in `<Text>`** — raw strings throw an error outside `<Text>`. This is because `ink-text` nodes have a Yoga measure function that measures actual text dimensions. Without it, Yoga can't size the node.

2. **`ink-virtual-text` has no YogaNode** — nested `<Text>` inside `<Text>` doesn't create layout nodes. Instead, text is "squashed" from the whole `ink-text` subtree into one string for measurement and rendering.

3. **The Output class is a character grid** — it's `StyledChar[][]` where each cell holds a character, its ANSI styles, and a fullWidth flag. This is conceptually identical to what Ratatui calls a `Buffer`.

4. **Throttled rendering** — Ink throttles renders to configurable maxFps (default 30). `resetAfterCommit` triggers `onRender`, which is throttled.

---

## 2. React Reconciler API

### Host Config Contract

The `react-reconciler` package requires a "host config" object. For a mutation-based renderer (our case), the critical methods are:

#### Instance Creation

| Method | When Called | What To Do |
|--------|-----------|------------|
| `createInstance(type, props, rootContainer, hostContext)` | React creates a new element | Create a DOMElement, create a YogaNode, apply style props to the YogaNode |
| `createTextInstance(text, rootContainer, hostContext)` | React creates a text node | Create a TextNode (no YogaNode), validate it's inside `ink-text` |

#### Tree Mutation (requires `supportsMutation: true`)

| Method | When Called | What To Do |
|--------|-----------|------------|
| `appendChild(parent, child)` | Append child to parent | Add to `childNodes`, call `yogaNode.insertChild()` |
| `appendChildToContainer(container, child)` | Append to root | Same as appendChild |
| `insertBefore(parent, child, beforeChild)` | Insert at specific position | Splice into `childNodes`, insert into YogaNode at index |
| `removeChild(parent, child)` | Remove child | Remove from `childNodes`, `yogaNode.removeChild()`, free YogaNode |
| `removeChildFromContainer(container, child)` | Remove from root | Same as removeChild |
| `commitUpdate(instance, type, oldProps, newProps)` | Props changed | Diff old/new props, update style on YogaNode, update attributes |
| `commitTextUpdate(node, oldText, newText)` | Text content changed | Update `nodeValue`, mark parent dirty for re-measurement |

#### Lifecycle & Context

| Method | Purpose |
|--------|---------|
| `getRootHostContext()` | Returns initial context (e.g., `{ isInsideText: false }`) |
| `getChildHostContext(parentContext, type)` | Updates context for children (set `isInsideText: true` inside `ink-text`) |
| `prepareForCommit()` | Called before commit phase — return null |
| `resetAfterCommit(rootNode)` | Called after commit — **trigger layout + render** |
| `finalizeInitialChildren()` | Post-creation hook — return false |
| `shouldSetTextContent()` | Whether element handles text directly — return false |

#### Visibility

| Method | Purpose |
|--------|---------|
| `hideInstance(node)` | Set `yogaNode.setDisplay(DISPLAY_NONE)` |
| `unhideInstance(node)` | Set `yogaNode.setDisplay(DISPLAY_FLEX)` |
| `hideTextInstance(node)` | Set `nodeValue = ''` |
| `unhideTextInstance(node, text)` | Restore `nodeValue` |

#### Required Flags

```typescript
{
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  isPrimaryRenderer: true,
}
```

### How Ink Uses the Reconciler

Ink's `createInstance` does:
1. Create a DOMElement via `createNode(type)`
2. This internally calls `Yoga.Node.create()` for non-virtual-text nodes
3. For `ink-text`, it attaches a measure function: `yogaNode.setMeasureFunc(measureTextNode)`
4. Apply all style props to the YogaNode via `applyStyles()`
5. Set attributes and transforms

The `resetAfterCommit` callback is the critical integration point — it fires `onComputeLayout()` (Yoga calculation) and then `onRender()` (tree-to-output conversion).

---

## 3. Yoga Layout Flow

### Setup

Each `ink-box` and `ink-text` creates a `Yoga.Node`. Nodes form a tree mirroring the DOMElement tree. Style properties map to Yoga setters:

| Ink Style Prop | Yoga Method |
|---------------|-------------|
| `width` | `setWidth(n)` / `setWidthPercent(n)` |
| `height` | `setHeight(n)` / `setHeightPercent(n)` |
| `padding` | `setPadding(EDGE_ALL, n)` |
| `paddingTop` | `setPadding(EDGE_TOP, n)` |
| `margin` | `setMargin(EDGE_ALL, n)` |
| `marginLeft` | `setMargin(EDGE_START, n)` |
| `flexDirection` | `setFlexDirection(FLEX_DIRECTION_ROW)` |
| `flexGrow` | `setFlexGrow(n)` |
| `flexShrink` | `setFlexShrink(n)` |
| `alignItems` | `setAlignItems(ALIGN_CENTER)` |
| `justifyContent` | `setJustifyContent(JUSTIFY_SPACE_BETWEEN)` |
| `position` | `setPositionType(POSITION_TYPE_ABSOLUTE)` |
| `display` | `setDisplay(DISPLAY_NONE)` |
| `borderStyle` | `setBorder(EDGE_*, 1)` (borders are always width 1) |
| `gap` | `setGap(GUTTER_ALL, n)` |

### Text Measurement

`ink-text` nodes have a custom measure function. When Yoga needs to know the size of a text node, it calls:

```typescript
measureTextNode(node, width) → { width: number, height: number }
```

This function:
1. Squashes all child text nodes into a single string
2. Measures the string's width using `string-width` (handles Unicode, emoji, ANSI)
3. If text is wider than the available width, wraps it according to `textWrap` style
4. Returns `{ width, height }` of the (possibly wrapped) text

### Layout Calculation

```typescript
rootNode.yogaNode.setWidth(terminalColumns);
rootNode.yogaNode.calculateLayout(undefined, undefined, DIRECTION_LTR);
```

### Computed Layout Data Available Per Node

After `calculateLayout()`, each YogaNode exposes:

| Getter | Returns | Meaning |
|--------|---------|---------|
| `getComputedLeft()` | float | X offset relative to parent's content box |
| `getComputedTop()` | float | Y offset relative to parent's content box |
| `getComputedWidth()` | float | Total width including padding + border |
| `getComputedHeight()` | float | Total height including padding + border |
| `getComputedPadding(edge)` | float | Resolved padding for EDGE_TOP/RIGHT/BOTTOM/LEFT |
| `getComputedBorder(edge)` | float | Resolved border for EDGE_TOP/RIGHT/BOTTOM/LEFT |
| `getComputedMargin(edge)` | float | Resolved margin for EDGE_TOP/RIGHT/BOTTOM/LEFT |
| `getDisplay()` | enum | DISPLAY_FLEX or DISPLAY_NONE |

Positions are relative to the parent node's border box. To get absolute screen coordinates, you accumulate offsets walking from root to leaf.

---

## 4. JSON Bridge Design

### Design Principle

The JSON message mirrors the Yoga node topology — one JSON object per DOMElement that has a YogaNode. Virtual text nodes and raw text nodes are collapsed into their parent `ink-text` as a `text` string field.

### Widget Tree Message Schema

```json
{
  "type": "render",
  "root": {
    "kind": "box",
    "id": 0,
    "layout": {
      "x": 0,
      "y": 0,
      "width": 80,
      "height": 24
    },
    "children": [...]
  }
}
```

### Node Schema — Box

```json
{
  "kind": "box",
  "id": 1,
  "layout": {
    "x": 0,
    "y": 0,
    "width": 80,
    "height": 3
  },
  "padding": { "top": 0, "right": 1, "bottom": 0, "left": 1 },
  "border": {
    "top": 1, "right": 1, "bottom": 1, "left": 1,
    "style": "single",
    "topColor": null,
    "rightColor": null,
    "bottomColor": null,
    "leftColor": null
  },
  "background": "#1a1a2e",
  "overflow": "visible",
  "children": [...]
}
```

### Node Schema — Text

```json
{
  "kind": "text",
  "id": 2,
  "layout": {
    "x": 1,
    "y": 1,
    "width": 20,
    "height": 1
  },
  "content": "Hello, world!",
  "wrap": "wrap"
}
```

The `content` field holds the squashed, pre-wrapped text string (with any inline ANSI styling already baked in from `chalk` or `<Text color="...">`).

### What the Rust Renderer Needs From Each Node

| Field | Source | Purpose |
|-------|--------|---------|
| `kind` | `nodeName` mapping | Determines rendering behavior |
| `layout.x` | `getComputedLeft()` accumulated | Absolute screen column |
| `layout.y` | `getComputedTop()` accumulated | Absolute screen row |
| `layout.width` | `getComputedWidth()` | Widget width in columns |
| `layout.height` | `getComputedHeight()` | Widget height in rows |
| `padding.*` | `getComputedPadding(edge)` | Content inset |
| `border.*` | `getComputedBorder(edge)` + style props | Border characters and colors |
| `background` | `style.backgroundColor` | Fill color |
| `overflow` | `style.overflow` | Clipping behavior |
| `content` | squashed text | Text to render (for text nodes) |
| `children` | recursive | Child widgets |

### Coordinates: Absolute vs Relative

Two viable approaches:

1. **Relative coordinates** (what Yoga outputs) — each node's `x,y` is relative to parent. Rust renderer accumulates offsets during traversal. Smaller messages, matches Yoga's native output.

2. **Absolute coordinates** — JS side pre-computes absolute `x,y` for each node. Rust renderer can paint directly without tree traversal. Simpler Rust code.

**Recommendation:** Use absolute coordinates. The JS side already does this accumulation in `renderNodeToOutput`. It keeps the Rust renderer simpler and the JSON message self-contained.

### Message Types

| Message | Direction | Purpose |
|---------|-----------|---------|
| `{ "type": "render", "root": {...} }` | JS → Rust | Full widget tree for rendering |
| `{ "type": "resize", "width": N, "height": N }` | JS → Rust | Terminal resize notification |
| `{ "type": "ready" }` | Rust → JS | Renderer initialized |
| `{ "type": "rendered" }` | Rust → JS | Frame complete (for backpressure) |

---

## 5. Rust Renderer Design

### Architecture (inspired by Ratatui/Crossterm)

```
JSON stdin
    │
    ▼
Message Parser (serde_json)
    │
    ▼
Widget Tree (deserialized structs)
    │
    ▼
Render to Buffer (paint widgets to Cell grid)
    │
    ▼
Diff against Previous Buffer
    │
    ▼
Emit ANSI escape sequences for changed cells
    │
    ▼
Write to stdout
```

### Cell Grid (Double Buffer)

```rust
struct Cell {
    grapheme: String,       // character(s) at this position
    fg: Option<Color>,      // foreground color
    bg: Option<Color>,      // background color
    bold: bool,
    italic: bool,
    underline: bool,
    dim: bool,
    // ... other ANSI attributes
}

struct Buffer {
    width: u16,
    height: u16,
    cells: Vec<Cell>,       // width * height cells, row-major
}
```

Two buffers are maintained:
- **current**: the buffer being painted to for this frame
- **previous**: the buffer from the last frame

### Rendering Algorithm

```
fn render_frame(tree: &WidgetNode, current: &mut Buffer, previous: &Buffer) {
    current.clear();                         // reset to spaces
    paint_node(tree, current);               // recursively paint widgets
    let diff = compute_diff(previous, current);
    emit_ansi(diff, stdout);                 // write only changed cells
    swap(current, previous);                 // current becomes previous
}
```

### Painting Widgets

For each node in the tree:
- **Box nodes**: Fill background color in the `(x, y, width, height)` region. Draw border characters. Recurse into children. Apply overflow clipping by constraining child painting to the content area.
- **Text nodes**: Write the content string character-by-character into the buffer at `(x, y)`, respecting the node's width/height bounds. Parse embedded ANSI codes to set cell styles.

### Diff Algorithm

```rust
fn compute_diff(prev: &Buffer, curr: &Buffer) -> Vec<CellUpdate> {
    let mut updates = Vec::new();
    for y in 0..curr.height {
        for x in 0..curr.width {
            let idx = y * curr.width + x;
            if prev.cells[idx] != curr.cells[idx] {
                updates.push(CellUpdate { x, y, cell: curr.cells[idx].clone() });
            }
        }
    }
    updates
}
```

Optimization: batch consecutive changed cells on the same row into a single write to avoid excess cursor-move commands.

### ANSI Output Strategy

```
\x1b[{row};{col}H    — move cursor to (row, col) (1-indexed)
\x1b[38;2;R;G;Bm     — set foreground RGB color
\x1b[48;2;R;G;Bm     — set background RGB color
\x1b[1m               — bold
\x1b[0m               — reset all attributes
{character}           — write the character
```

Use crossterm as the backend library — it handles platform differences (Windows Console API vs ANSI) and provides:
- `cursor::MoveTo(col, row)`
- `style::SetForegroundColor`, `SetBackgroundColor`
- `style::SetAttribute`
- `terminal::EnterAlternateScreen`, `LeaveAlternateScreen`
- Raw mode management

### Border Rendering

Borders use box-drawing characters from `cli-boxes` style sets:

| Style | TL | TR | BL | BR | H | V |
|-------|----|----|----|----|---|---|
| single | ┌ | ┐ | └ | ┘ | ─ | │ |
| double | ╔ | ╗ | ╚ | ╝ | ═ | ║ |
| round | ╭ | ╮ | ╰ | ╯ | ─ | │ |
| bold | ┏ | ┓ | ┗ | ┛ | ━ | ┃ |

The Rust renderer needs a lookup table for these. The `border.style` field in the JSON selects which set to use.

---

## 6. Complete Data Flow

### Frame Lifecycle

```
1. State Change (setState, useReducer, etc.)
       │
2. React schedules re-render
       │
3. React reconciler calls host config methods:
   ├─ createInstance() for new elements
   ├─ commitUpdate() for changed props
   ├─ appendChild/removeChild() for tree changes
   └─ commitTextUpdate() for text changes
       │
4. resetAfterCommit(rootNode) fires
       │
5. rootNode.onComputeLayout() executes:
   ├─ rootNode.yogaNode.setWidth(terminalColumns)
   └─ rootNode.yogaNode.calculateLayout(...)
       │
6. Walk DOMElement tree, read computed layout from each yogaNode
       │
7. Serialize tree to JSON:
   ├─ Accumulate absolute coordinates
   ├─ Read layout (x, y, width, height)
   ├─ Read padding, border, margin
   ├─ Read style props (backgroundColor, borderStyle, etc.)
   └─ Squash text content for ink-text nodes
       │
8. Write JSON message to Rust process stdin
       │
9. Rust: parse JSON → WidgetNode tree
       │
10. Rust: paint tree to current Buffer (Cell grid)
    ├─ For each box: fill bg, draw borders, recurse children
    └─ For each text: write content chars with styles
       │
11. Rust: diff current Buffer vs previous Buffer
       │
12. Rust: emit minimal ANSI escape sequences for diff
       │
13. Rust: flush to stdout → terminal displays frame
       │
14. Rust: send "rendered" ack to JS (backpressure)
       │
15. Swap buffers. Ready for next frame.
```

### Component Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│  JavaScript Process                                          │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │ React        │───▶│ Reconciler   │───▶│ DOM Tree      │  │
│  │ Components   │    │ (host config)│    │ (DOMElement)  │  │
│  └──────────────┘    └──────────────┘    └───────┬───────┘  │
│                                                  │          │
│                                          ┌───────▼───────┐  │
│                                          │ Yoga Layout   │  │
│                                          │ (WASM)        │  │
│                                          └───────┬───────┘  │
│                                                  │          │
│                                          ┌───────▼───────┐  │
│                                          │ JSON          │  │
│                                          │ Serializer    │  │
│                                          └───────┬───────┘  │
│                                                  │          │
└──────────────────────────────────────────────────┼──────────┘
                                      JSON over stdin/stdout
┌──────────────────────────────────────────────────┼──────────┐
│  Rust Process                                    │          │
│                                          ┌───────▼───────┐  │
│                                          │ JSON Parser   │  │
│                                          │ (serde)       │  │
│                                          └───────┬───────┘  │
│                                                  │          │
│                                          ┌───────▼───────┐  │
│                                          │ Widget Tree   │  │
│                                          │ (structs)     │  │
│                                          └───────┬───────┘  │
│                                                  │          │
│                                          ┌───────▼───────┐  │
│                                          │ Buffer        │  │
│                                          │ Painter       │  │
│                                          └───────┬───────┘  │
│                                                  │          │
│                                          ┌───────▼───────┐  │
│                                          │ Diff Engine   │  │
│                                          └───────┬───────┘  │
│                                                  │          │
│                                          ┌───────▼───────┐  │
│                                          │ ANSI Emitter  │  │
│                                          │ (crossterm)   │  │
│                                          └───────┬───────┘  │
│                                                  │          │
│                                              stdout         │
│                                                  │          │
└──────────────────────────────────────────────────┼──────────┘
                                                   ▼
                                              Terminal
```

### IPC Design

The JS process spawns the Rust binary as a child process. Communication happens via:
- **JS → Rust**: Write JSON messages to the child's stdin (newline-delimited JSON / NDJSON)
- **Rust → JS**: Write JSON messages to the child's stdout, which JS reads

The terminal output goes directly from Rust to the inherited terminal (stderr or a separate fd). Alternatively, Rust can write directly to `/dev/tty` (or `CONOUT$` on Windows) to bypass pipe capture.

**Simpler alternative**: Rust inherits the terminal's stdout. JSON flows over a different channel (unix socket, named pipe, or Rust reads from its stdin while writing to the raw terminal fd).

---

## 7. Suggested Build Order

### Phase 1: Minimal Vertical Slice

**Goal:** `<Box><Text>Hello</Text></Box>` renders in the terminal via Rust.

1. **Rust: Cell Buffer + ANSI Emitter** — Implement `Buffer`, `Cell`, basic ANSI output. Test by hardcoding a buffer and printing it.

2. **Rust: JSON Parser** — Define `WidgetNode` structs with serde. Parse a hardcoded JSON tree. Paint it to the buffer.

3. **Rust: stdin reader** — Read NDJSON from stdin, parse, render.

4. **JS: Fork Ink's DOM + Reconciler** — Copy `dom.ts`, `reconciler.ts`, `styles.ts` from Ink. Minimal modifications: remove Ink's output rendering, keep the DOM tree and Yoga integration intact.

5. **JS: Tree Serializer** — Walk the DOMElement tree after Yoga layout, produce JSON matching the Rust schema.

6. **JS: Process Bridge** — Spawn Rust binary, pipe JSON to its stdin.

7. **JS: Ink-compatible Entry Point** — `render(<App />)` that wires up reconciler → Yoga → JSON → Rust.

### Phase 2: Full Box Model

8. **Rust: Border rendering** — Box-drawing characters, border styles, border colors.

9. **Rust: Background colors** — Fill box regions with background color.

10. **Rust: Padding/Margin** — Content offset within boxes (padding is already handled by Yoga coordinates; verify rendering respects it).

11. **Rust: Overflow clipping** — Skip painting outside parent bounds when `overflow: hidden`.

### Phase 3: Text Rendering

12. **Rust: ANSI-aware text painting** — Parse ANSI codes in text content to set cell styles. Handle wide characters (emoji, CJK).

13. **Rust: Text wrapping** — Verify wrapped text from JS side renders correctly. May need to handle wrap on the Rust side for dynamic content.

### Phase 4: Diff Optimization

14. **Rust: Double buffering + diff** — Only emit changed cells between frames.

15. **Rust: Batched cursor moves** — Group consecutive cell changes on the same row into single writes.

16. **JS: Throttled rendering** — Port Ink's throttle logic (or rely on backpressure from Rust acks).

### Phase 5: Feature Parity

17. **Terminal resize handling** — Detect SIGWINCH, re-layout, re-render.

18. **Alternate screen** — Enter/leave alternate buffer.

19. **Cursor management** — Hide/show cursor, cursor positioning for input.

20. **Input handling** — Forward stdin from terminal to JS process for `useInput()`.

21. **Static output** — Ink's `<Static>` component for content that scrolls up.

### Dependency Graph

```
                    ┌──────────────┐
                    │ Cell + Buffer│ ◄── start here
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ ANSI Emitter │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ JSON Parser  │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼───────┐   │    ┌───────▼──────┐
       │ Box Painter  │   │    │ Text Painter │
       └──────┬───────┘   │    └───────┬──────┘
              │            │            │
              └────────────┼────────────┘
                           │
                    ┌──────▼───────┐
                    │ Diff Engine  │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ stdin Reader │ ◄── Rust side complete
                    └──────────────┘

        ═══════════════════════════════

                    ┌──────────────┐
                    │ Fork Ink DOM │ ◄── JS side starts
                    │ + Reconciler │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ Yoga Layout  │ (already in Ink's code)
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ Tree → JSON  │
                    │ Serializer   │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ Process      │
                    │ Bridge       │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ render() API │ ◄── JS side complete
                    └──────────────┘
```

**The Rust and JS sides can be built in parallel** once the JSON schema is agreed upon. Start both sides with hardcoded test data, then connect them.

### What Depends on What

| Component | Depends On |
|-----------|-----------|
| ANSI Emitter | Cell + Buffer |
| JSON Parser | WidgetNode struct definitions |
| Box Painter | Cell + Buffer |
| Text Painter | Cell + Buffer |
| Diff Engine | Cell + Buffer (needs two buffers) |
| stdin Reader | JSON Parser, Box/Text Painters, Diff Engine |
| Fork Ink DOM | Nothing (copy from Ink) |
| Yoga Layout | Fork Ink DOM (already integrated) |
| Tree Serializer | Yoga Layout (reads computed values) |
| Process Bridge | Tree Serializer (produces JSON), Rust binary (consumes it) |
| render() API | All of the above |

---

## Key Design Decisions to Make Early

1. **IPC mechanism**: stdin/stdout NDJSON (simplest) vs Unix socket vs shared memory. NDJSON is recommended for v1.

2. **Coordinate system**: Absolute (pre-computed in JS) vs relative (accumulated in Rust). Absolute recommended.

3. **Text content**: Pre-styled with ANSI (JS handles chalk/color output) vs structured style spans. Pre-styled ANSI is recommended for v1 since it matches Ink's existing behavior where `<Text color="red">` produces ANSI-wrapped strings.

4. **Terminal output fd**: Rust inherits terminal directly (write to `/dev/tty` or `CONOUT$`) vs writing to its own stdout. Direct terminal access recommended to keep JSON and terminal output on separate channels.

5. **Incremental updates**: Full tree JSON every frame vs tree diffing on JS side. Full tree recommended for v1 (simpler), optimize later with dirty-node tracking.
