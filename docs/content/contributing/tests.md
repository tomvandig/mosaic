# Tests

The TypeScript SDK is tested end to end: each case builds a real `.mosaic` archive from an example
dataset, reads it back through `LoadMosaicFile`, and asserts on what a reader sees.

```bash
cd sdk/ts
npm install
npm test
```

The runner is Node's built-in `node:test` with native TypeScript execution, so there is no test
framework or build step to configure. Example datasets live in [`sdk/ts/test-data/`](https://github.com/tomvandig/mosaic/tree/main/sdk/ts/test-data/)
and are documented in the README there.

The IFC converter is tested the same way, from its own package, against a hand-written IFC4 file
small enough to read in one sitting:

```bash
cd sdk/ifc4
npm install
npm test
```
