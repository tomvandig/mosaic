import { HttpSource } from "../HttpSource.ts";
// @ts-expect-error -- the viewer is plain JavaScript, deliberately: it is the same file
// the static build runs, and nothing in it needs types to be correct.
import { start } from "./app.js";

/**
 * The viewer, against the server that served it.
 *
 * This is what `mosaic serve` puts at `/`. There is nothing to choose: the archives are
 * whatever the database behind this server holds, and the page asks it for them.
 */
await start(new HttpSource(""));
