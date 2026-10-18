# Label Split

Split A4 shipping-label sheets (e.g. Australia Post) into one label per printer page, ready for a 100 × 150 mm thermal printer.

**Live:** https://nickpstone.github.io/label-split/

- Detects labels on each sheet and shows a preview. Untick any label you don't want.
- Exports a vector PDF at the exact page size, so barcodes stay sharp. Print it directly or download it.
- Layouts: Australia Post (2 labels on the left), 2 full-width halves, 2 × 2 grid, or 1 label per page.
- Your PDFs are processed in the browser and never uploaded. Only printer preferences are saved.

## Development

```bash
npm install
npm run dev     # http://127.0.0.1:4173
npm test        # unit tests
npm run build   # static site in dist/ (auto-deployed to GitHub Pages on push)
```

Built with [PDF.js](https://mozilla.github.io/pdf.js/) and [pdf-lib](https://pdf-lib.js.org/) on Vite.
