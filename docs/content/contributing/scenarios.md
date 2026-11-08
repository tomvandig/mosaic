# Scenarios

[`sdk/scenarios/`](https://github.com/tomvandig/mosaic/tree/main/sdk/scenarios/) describes, in prose, things a user of Mosaic actually does — and
holds the tests generated from those descriptions. One folder per scenario: the Markdown is the
source, and `<name>.test.ts` beside it mirrors the prose step for step, with each `Given` / `When` /
`Then` as the comment above the code that carries it out.

They run for real. Every scenario gets a temporary folder and, when it asks for one, a server
listening on a free port; both are cleaned up afterwards, whether it passed or not.

```bash
cd sdk/scenarios
npm install
npm test
```

[publish-a-tessera](https://github.com/tomvandig/mosaic/blob/main/sdk/scenarios/publish-a-tessera/publish-a-tessera.md) writes a source document to
disk, packs it into an archive, publishes it through the API as a tessera's first version, downloads
it back byte for byte, composes it into a `.glb`, and checks that a second version claiming to follow
nothing is answered with `OUT_OF_DATE`.

[fetch-some-nodes](https://github.com/tomvandig/mosaic/blob/main/sdk/scenarios/fetch-some-nodes/fetch-some-nodes.md) publishes a tessera and then
takes pieces of it: one node as a `.glb`, the same node as a `.tsr` that is published again as
another tessera, a node narrowed to one component type, and a parent with everything beneath it.
