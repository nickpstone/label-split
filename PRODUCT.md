# Label Split
<!-- impeccable:product-schema 1 -->
## Platform
web
## Users and purpose
A daily shipping workflow: split Australia Post A4 PDFs like the user's sample into one label per printer page.
## Stack
Browser application using PDF.js for inspection and previews, pdf-lib for vector-preserving page extraction, Vite for bundling. This is an implementation choice for the requested small web app.
## Confirmed constraints
Hosted website accessible from other computers; default output 100 × 150 mm, confirmed by the user. Input sample has three A4 pages with two portrait labels stacked in the left half of each sheet. Preserve addresses, barcodes, and label ordering. Files are processed in browser memory, not uploaded or retained. Include preview, PDF download, and printing. Persist printer preferences only.
