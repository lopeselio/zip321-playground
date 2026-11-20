# zip321-playground

A web page for inspecting Zcash [ZIP-321](https://zips.z.cash/zip-0321) payment request URIs
(`zcash:…?amount=…&memo=…`). Paste a URI, scan its QR code or pick an example, and see exactly what a
wallet would pay, or why the request is rejected.

**Live:** https://lopeselio.github.io/zip321-playground/

It is built on [zip321](https://github.com/lopeselio/zip321-js), a pure-TypeScript ZIP-321 implementation with
no WASM and no runtime dependencies. The library is about 7 kB gzipped and parses a request in well under a
millisecond, so a page like this needs nothing else. Everything runs in the browser; nothing is sent anywhere.

## Features

- Live parsing as you type, with examples of valid and invalid requests.
- Options for the expected network (any, mainnet, testnet, regtest) and for address validation.
- One card per payment: address, address type, network, Unified Address receivers (P2PKH, Sapling,
  Orchard/Ironwood-format, unknown typecodes), memo capability, transparent-only warning, amount in ZEC and
  zatoshi, Custom Asset, memo (text or hex), label, message and unknown parameters. Plus the total.
- Errors show the `ZIP321Error` code, message and parameter, and highlight that parameter in the URI.
- The canonical form (`formatPaymentRequest(parsePaymentRequest(uri))`), and whether the input already was.
- QR codes: scan with the camera (native `BarcodeDetector`, or jsQR where it is missing), read an uploaded
  image, and show a QR code of the current request.
- The URI is kept in the URL hash (`#uri=…`), so any state can be shared as a link.
- Works offline once loaded, keyboard accessible, light and dark themes, usable on a 360 px screen.

## Develop

Requires Node 22.18 or newer.

```sh
npm install
npm run dev        # local server
npm test           # unit tests of the view-model logic (node --test)
npm run typecheck
npm run build      # static site in dist/
npm run check      # all of the above
```

The parsing and presentation logic lives in plain modules (`src/inspect.ts`, `src/tokens.ts`, `src/hash.ts`)
that turn a URI and options into a view model; `src/render.ts` and `src/main.ts` only draw it. Pushing to
`main` deploys to GitHub Pages.

Example addresses come from the ZIP-321 specification, the zip321 test suite and the public
zcash-test-vectors. MIT licensed.
