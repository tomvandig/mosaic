# Scenarios

A scenario is a description, in prose, of something a user of Mosaic actually does — publishing a
dataset, fetching one back, composing one for a viewer. The description is the source; the test
beside it is generated from that description, and runs the whole thing for real: real files in a
temporary folder, and a real HTTP server listening on a real port.

```bash
npm install
npm test
```

## The shape of a scenario

**One folder per scenario**, named after it, holding the prose and the code generated from it:

```
scenarios/
  publish-a-tessera/
    publish-a-tessera.md        the scenario, in words
    publish-a-tessera.test.ts   generated from it
  support/
    scenario.ts                 the folder and the server every scenario is given
```

The Markdown is written first and is the thing to change. The test mirrors it step by step, with each
`Given` / `When` / `Then` copied into the code as the comment above the lines that carry it out — so
the two can be read side by side, and a step with no code, or code with no step, is visible.

Write the prose as a heading, a short paragraph saying why the scenario matters, and then bullets:

```markdown
# Publishing a tessera and getting it back

## Background
- **Given** a temporary folder that exists only for this scenario
- **And** a Mosaic server running on a free port, keeping its database in that folder

## Scenario: a first version is published and read back unchanged
- **Given** a source document `terrace.mosaic.json` in the folder, describing two walls
- **When** I create a tessera named `Terrace`
- **Then** it is listed with no version yet
```

Nothing parses this, so it does not have to be Gherkin — it has to be clear. Name real files and real
values where you can (`terrace.tsr`, `ada@example.com`, `OUT_OF_DATE`), because those are what the
generated assertions will check.

## What a scenario is given

`runScenario(name, body)` from [`support/scenario.ts`](support/scenario.ts) hands the body a `world`:

| | |
| --- | --- |
| `world.folder` | a temporary folder that exists only for this run |
| `world.file(...parts)` | a path inside it, with parent folders created |
| `world.write(name, contents)` | writes a file there and returns its path |
| `world.startServer()` | a server on a free port, its database inside the folder |
| `world.client()` | a generated API client pointed at that server |

Whatever the body does, the server is stopped and the folder removed afterwards — which is what the
**Afterwards** section of a scenario describes. Nothing is left listening and nothing is left on disk,
so scenarios can run side by side and in any order.

## Adding one

1. Make a folder named after the scenario.
2. Write `<name>.md` in it.
3. Generate `<name>.test.ts` beside it, following the prose step for step.
4. `npm test`.

The tests are plain `node:test` files, so a single one runs with:

```bash
node --experimental-transform-types --test publish-a-tessera/publish-a-tessera.test.ts
```
