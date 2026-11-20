# BIM Viewer 

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

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

`model` is the XKT URL and `metadata` the optional JSON metadata URL, both read once when the element is added. To load from memory instead, set the `modelBuffer` property to an `ArrayBuffer` with the XKT file, and before it optionally `metadataBuffer` to an `ArrayBuffer` with the JSON metadata as UTF-8 text (`document.querySelector('xeo-viewer').modelBuffer = buffer`). These are JavaScript properties, not HTML attributes, and each new `modelBuffer` loads another model. `primary-color` takes any CSS color for buttons, active tools and selection (default violet) and can change at any time. The boolean `compact` attribute tightens spacing and text so the UI takes less room. The boolean `allow-drop-zone` attribute lets users drop .xkt and .json files onto the viewer to load them; without it dropping is off. It can change at any time. The element is 480px high by default and a page holds one viewer.

`pnpm example` builds the web component and opens [example/index.html](example/index.html), which embeds it with the sample model.

## License

This project uses the [GNU Affero General Public License v3.0](LICENSE).
