import type { ComponentElement } from "../MosaicIndexFile.ts";

/**
 * Where the viewer gets its archives from.
 *
 * The viewer used to talk to `mosaic serve` over http, which meant it only ran where a
 * server was running. The questions it asks are not http questions though -- they are
 * "what is here", "give me these nodes as a glb", "what does this node carry" -- and a
 * .tsr file on its own can answer all three. So the questions are written down here as a
 * TypeScript interface, and the transport is one of the answers rather than part of them.
 *
 * Two things implement it. {@link HttpSource} asks a running server, which is what the
 * page served by the CLI does. {@link ArchiveSource} holds the archives in memory and
 * answers out of them, which is what the static build does -- the selection and the glTF
 * conversion are ordinary TypeScript and run in a browser as happily as in the server.
 *
 * The shapes below are the ones the http endpoints already answer with, so the http
 * implementation is a fetch and a parse, and nothing in the viewer had to change to gain
 * the second one.
 */
export interface MosaicSource {
    /** Which of the two this is, for the parts of the UI that differ. */
    readonly kind: "server" | "archives";

    /** Everything available, with each tessera's versions, newest last. */
    tesserae(): Promise<TesseraSummary[]>;

    /**
     * Some nodes of some versions, as one binary glTF.
     *
     * Naming no nodes means the roots of everything asked for. The viewer reads both the
     * tree and the picture out of the answer, so this is the one call a scene costs.
     */
    glb(request: SelectionAcross): Promise<Uint8Array>;

    /**
     * The same selection, described rather than drawn: which nodes, what they carry, and
     * what imported what.
     *
     * The viewer asks for this one node at a time, to read the components of whatever is
     * selected without having read every property set in the building up front.
     */
    scene(request: SelectionAcross): Promise<Scene>;

    /**
     * Takes an archive and makes it available, as a new tessera or a new version of one
     * with that name.
     *
     * Optional: a source with nothing to write to leaves it out, and the viewer hides the
     * drop target rather than offering something that cannot work.
     */
    add?(name: string, bytes: Uint8Array): Promise<TesseraSummary>;
}

/** One tessera and the versions it has. */
export interface TesseraSummary {
    id: string;
    name: string;
    versions: VersionSummary[];
}

export interface VersionSummary {
    versionId: string;
    message?: string;
    author?: string;
}

/** A version of a tessera, named. */
export interface VersionRef {
    tesseraId: string;
    versionId: string;
}

/**
 * A selection over several versions read together.
 *
 * More than one version at a time is the point: a child reference that leaves one tessera
 * and lands in another is an ordinary link once both are in scope, which is what makes
 * two archives shown together one tree instead of two.
 */
export interface SelectionAcross {
    versions: VersionRef[];
    /** The nodes to take. Left out or empty means the roots of everything asked for. */
    nodes?: string[] | null;
    /** Take everything beneath them, however deep. Defaults to true. */
    includeChildren?: boolean;
    /** Resolve inheritance first, so a node that is-a something carries its components. */
    compose?: boolean;
    /** Only these component types. All of them when left out or empty. */
    componentTypes?: string[];
}

/** A node as the tree and the panels need it. */
export interface SceneNode {
    id: string;
    /** A name is a value-less component, so this is that component's reference id. */
    name: string | null;
    children: string[];
    components: SceneComponent[];
    /** The tessera the node is written in, which is what a cross-archive link looks like. */
    tessera: string | null;
    tesseraId: string | null;
    versionId: string | null;
}

export interface SceneComponent {
    type: string;
    id: string;
    index: number;
    value: unknown;
}

export interface Scene {
    /** The versions asked for, with their roots. */
    versions: Array<VersionRef & { name: string; roots: string[] }>;
    /** What came along because something on show imports it. */
    imported: Array<VersionRef & { name: string }>;
    roots: string[];
    nodes: Record<string, SceneNode>;
    warnings: string[];
}

/** The reference as it is written in an index, with the index defaulted. */
export function componentAt(reference: ComponentElement): { type: string; id: string; index: number } {
    return { type: reference.type, id: reference.id, index: reference.index ?? -1 };
}
