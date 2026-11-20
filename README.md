# xeoViewer

A browser-based BIM viewer for XKT models, built on the [xeokit SDK](https://xeokit.io), [Nuxt](https://nuxt.com) and [Nuxt UI](https://ui.nuxt.com). It ships as a static site and as a single-file `<xeo-viewer>` web component that drops into any page.

## Features

- Loads `.xkt` models with optional JSON metadata from a URL, from files picked or dropped onto the viewer, or from memory as an `ArrayBuffer`.
- Explorer panel with object, class and storey trees, search with result stepping, visibility checkboxes and fly-to on double-click.
- Properties panel with the IFC attributes and property sets of the selected object, searchable, where any value can be added to the filters.
- Filters by IFC class and property conditions, and grouping that colors objects by nested criteria with a legend.
- Tools to select and hide objects, measure distances with snapping and axis wires, and slice the model with section planes and filled caps.
- Walk mode with WASD movement, flying, walking through doors, and hiding, moving and inspecting objects on the way.
- Context menus for X-ray, hide others and view fit, a navigation cube, and a perspective or orthographic camera.
- Floating, resizable panels that remember their layout, and light and dark themes.

## Setup

Make sure to install dependencies:

```bash
pnpm install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
pnpm dev
```

## Production

`pnpm build` runs both builds.

### Static site

```bash
pnpm build:static
```

Emits plain static files to `.output/public`. Open it with `?model=<xkt url>` (and optionally `&metadata=<json url>`) to load a model on start.

### Web component

```bash
pnpm build:webcomponent
```

Emits a single `dist/webcomponent/xeo-viewer.js` with styles, icons and images inlined:

```html
<script type="module" src="xeo-viewer.js"></script>

<xeo-viewer model="https://example.com/model.xkt" style="height: 600px"></xeo-viewer>
```

The same file is on npm as [`@xeofoundry/xeo-viewer`](https://www.npmjs.com/package/@xeofoundry/xeo-viewer):

```bash
npm install @xeofoundry/xeo-viewer
```

```js
import '@xeofoundry/xeo-viewer'
```

You can also load it from a CDN without an install step:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@xeofoundry/xeo-viewer"></script>
```

| Name | Type | Description |
| --- | --- | --- |
| `model` | attribute | URL of the XKT file. Read once, when the element is added. |
| `metadata` | attribute | Optional URL of the model's JSON metadata. Read once, when the element is added. |
| `modelBuffer` | JS property | `ArrayBuffer` with an XKT file, to load from memory. Each new buffer loads another model. |
| `metadataBuffer` | JS property | Optional `ArrayBuffer` with the JSON metadata as UTF-8 text. Set it before `modelBuffer`. |
| `primary-color` | attribute | Any CSS color for buttons, active tools and selection. Violet by default, can change at any time. |
| `compact` | boolean attribute | Tightens spacing and text so the UI takes less room. |
| `allow-drop-zone` | boolean attribute | Lets users drop .xkt and .json files onto the viewer to load them. Off without it, can change at any time. |

JS properties are set on the element, for example `document.querySelector('xeo-viewer').modelBuffer = buffer`. The element is 480px high by default and a page holds one viewer.

### Example

```bash
pnpm example
```

Builds the web component, serves the repository with `vite preview` and opens [example/index.html](example/index.html) in the browser. The page embeds `<xeo-viewer>` with the sample model from `public/models` and shows how to use it.

## Release

The `Publish to npm` workflow runs on every merge to `main`. If the version in [npm/package.json](npm/package.json) is not on npm, the workflow publishes the web component.

1. Change `version` in `npm/package.json` in your pull request.
2. Merge the pull request to `main`.

If you do not change the version, the workflow skips the publish step.

## License

This project uses the [GNU Affero General Public License v3.0](LICENSE).
