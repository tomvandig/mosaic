import type { MosaicFile } from "../MosaicFile.ts";
import type { NodeElement } from "../MosaicIndexFile.ts";
import { collapseNodesByPath } from "../MosaicFileOperations.ts";

/**
 * A small CSS-flavoured selector language for naming nodes by something a human wrote,
 * rather than by the uuid a converter happened to mint.
 *
 * ```
 *   #11111111-1111-4111-8111-111111111111   a node id, like a CSS id
 *   .mesh                                   a node carrying a component named "mesh"
 *   khronos::gltf::meshPrimitive            a node carrying a component of that type
 *   [name="Brick"]                          a node one of whose components has name: "Brick"
 *   [name^="mesh_helmet"]                   ...starting with, ending with ($=), containing (*=)
 *   *                                       any node
 *   DamagedHelmet.glb|.mesh                 scoped to one section, like a CSS namespace
 * ```
 *
 * Simple selectors written together must all hold: `.mesh[name="Brick"]` is a node carrying
 * a component named "mesh" that also has a component named Brick. A bare uuid means `#uuid`,
 * so a plain node id stays a valid selector.
 *
 * There are deliberately no combinators (` `, `>`): the hierarchy a combinator would walk is
 * the very thing these selectors are used to build.
 */

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export type MatchOperator = "=" | "^=" | "$=" | "*=";

export type SimpleSelector =
    | { kind: "any" }
    | { kind: "id"; value: string }
    | { kind: "componentName"; value: string }
    | { kind: "componentType"; value: string }
    | { kind: "attribute"; key: string; operator: MatchOperator; value: string };

export interface Selector {
    /** A section id the node must appear in. Absent, or "*", means any section. */
    scope?: string;
    simples: SimpleSelector[];
    /** The text this was parsed from, for error messages. */
    source: string;
}

/** What a node offers a selector to match against. */
export interface NodeFacts {
    node: NodeElement;
    id: string;
    /** The names of the component references the node carries. */
    componentNames: Set<string>;
    /** The typeIDs of those components. */
    componentTypes: Set<string>;
    /** The component values themselves, for attribute matching. */
    values: Array<Record<string, unknown>>;
    /** The ids of the sections the node appears in. */
    sections: Set<string>;
}

class SelectorSyntaxError extends Error {
    constructor(selector: string, detail: string) {
        super(`Invalid selector "${selector}": ${detail}`);
        this.name = "SelectorSyntaxError";
    }
}

/** Reads an identifier, honouring CSS-style backslash escapes (`mesh\.0`). */
function readIdentifier(text: string, start: number, stopAt: string): [string, number] {
    let out = "";
    let i = start;

    while (i < text.length) {
        const ch = text[i]!;
        if (ch === "\\") {
            if (i + 1 >= text.length) throw new SelectorSyntaxError(text, "trailing backslash");
            out += text[i + 1];
            i += 2;
            continue;
        }
        if (stopAt.includes(ch)) break;
        out += ch;
        i++;
    }

    return [out, i];
}

function readQuoted(text: string, start: number): [string, number] {
    const quote = text[start]!;
    let out = "";
    let i = start + 1;

    while (i < text.length) {
        const ch = text[i]!;
        if (ch === "\\") {
            if (i + 1 >= text.length) throw new SelectorSyntaxError(text, "trailing backslash");
            out += text[i + 1];
            i += 2;
            continue;
        }
        if (ch === quote) return [out, i + 1];
        out += ch;
        i++;
    }

    throw new SelectorSyntaxError(text, `unterminated ${quote} string`);
}

export function parseSelector(text: string): Selector {
    const trimmed = text.trim();
    if (trimmed.length === 0) throw new SelectorSyntaxError(text, "it is empty");

    // A bare uuid is the id of a node, so ids written on their own keep working.
    if (UUID.test(trimmed)) return { simples: [{ kind: "id", value: trimmed }], source: text };

    let scope: string | undefined;
    let rest = trimmed;

    // A namespace-style prefix scopes the match to one section, as `ns|E` does in CSS.
    // The bar is only a scope when it is not inside brackets or a string.
    const bar = indexOfScopeBar(trimmed);
    if (bar !== -1) {
        scope = trimmed.slice(0, bar);
        rest = trimmed.slice(bar + 1);
        if (rest.length === 0) throw new SelectorSyntaxError(text, "nothing follows the scope");
    }

    const simples: SimpleSelector[] = [];
    let i = 0;

    while (i < rest.length) {
        const ch = rest[i]!;

        if (ch === "*") {
            simples.push({ kind: "any" });
            i++;
        } else if (ch === "#") {
            const [value, next] = readIdentifier(rest, i + 1, "#.[*");
            if (value.length === 0) throw new SelectorSyntaxError(text, "# with no id after it");
            simples.push({ kind: "id", value });
            i = next;
        } else if (ch === ".") {
            const [value, next] = readIdentifier(rest, i + 1, "#.[*");
            if (value.length === 0) throw new SelectorSyntaxError(text, ". with no component name after it");
            simples.push({ kind: "componentName", value });
            i = next;
        } else if (ch === "[") {
            const [simple, next] = readAttribute(rest, i, text);
            simples.push(simple);
            i = next;
        } else {
            // A bare token is a component typeID, the way a bare token is a tag in CSS.
            const [value, next] = readIdentifier(rest, i, "#[*");
            if (value.length === 0) throw new SelectorSyntaxError(text, `unexpected "${ch}"`);
            simples.push({ kind: "componentType", value });
            i = next;
        }
    }

    if (simples.length === 0) throw new SelectorSyntaxError(text, "it selects nothing");

    return scope !== undefined ? { scope, simples, source: text } : { simples, source: text };
}

function indexOfScopeBar(text: string): number {
    let inBrackets = false;
    let quote: string | undefined;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i]!;
        if (ch === "\\") {
            i++;
        } else if (quote !== undefined) {
            if (ch === quote) quote = undefined;
        } else if (ch === '"' || ch === "'") {
            quote = ch;
        } else if (ch === "[") {
            inBrackets = true;
        } else if (ch === "]") {
            inBrackets = false;
        } else if (ch === "|" && !inBrackets) {
            return i;
        }
    }

    return -1;
}

function readAttribute(rest: string, start: number, source: string): [SimpleSelector, number] {
    const [key, afterKey] = readIdentifier(rest, start + 1, "=^$*]");
    if (key.length === 0) throw new SelectorSyntaxError(source, "[ with no key after it");

    let i = afterKey;
    let operator: MatchOperator;

    if (rest[i] === "=") {
        operator = "=";
        i += 1;
    } else if ((rest[i] === "^" || rest[i] === "$" || rest[i] === "*") && rest[i + 1] === "=") {
        operator = `${rest[i]}=` as MatchOperator;
        i += 2;
    } else {
        throw new SelectorSyntaxError(source, `expected =, ^=, $= or *= after "${key}"`);
    }

    let value: string;
    if (rest[i] === '"' || rest[i] === "'") {
        [value, i] = readQuoted(rest, i);
    } else {
        [value, i] = readIdentifier(rest, i, "]");
    }

    if (rest[i] !== "]") throw new SelectorSyntaxError(source, "unclosed [");

    return [{ kind: "attribute", key, operator, value }, i + 1];
}

function matchesAttribute(facts: NodeFacts, simple: Extract<SimpleSelector, { kind: "attribute" }>): boolean {
    for (const value of facts.values) {
        const actual = value[simple.key];
        if (actual === undefined || actual === null) continue;

        const text = typeof actual === "string" ? actual : JSON.stringify(actual);
        switch (simple.operator) {
            case "=": if (text === simple.value) return true; break;
            case "^=": if (text.startsWith(simple.value)) return true; break;
            case "$=": if (text.endsWith(simple.value)) return true; break;
            case "*=": if (text.includes(simple.value)) return true; break;
        }
    }

    return false;
}

export function matches(facts: NodeFacts, selector: Selector): boolean {
    if (selector.scope !== undefined && selector.scope !== "*" && !facts.sections.has(selector.scope)) return false;

    return selector.simples.every(simple => {
        switch (simple.kind) {
            case "any": return true;
            case "id": return facts.id === simple.value;
            case "componentName": return facts.componentNames.has(simple.value);
            case "componentType": return facts.componentTypes.has(simple.value);
            case "attribute": return matchesAttribute(facts, simple);
        }
    });
}

/**
 * Gathers what every node in a file offers a selector, from the collapsed node set plus
 * the sections each node appears in.
 */
export function buildNodeFacts(file: MosaicFile): NodeFacts[] {
    const sectionsById = new Map<string, Set<string>>();
    for (const section of file.index.sections) {
        for (const node of section.nodes) {
            const seen = sectionsById.get(node.id);
            if (seen) seen.add(section.header.id);
            else sectionsById.set(node.id, new Set([section.header.id]));
        }
    }

    return [...collapseNodesByPath(file).values()].map(node => {
        const componentNames = new Set<string>();
        const componentTypes = new Set<string>();
        const values: Array<Record<string, unknown>> = [];

        for (const ref of node.components ?? []) {
            componentNames.add(ref.name);
            componentTypes.add(ref.typeID);
            try {
                const value = JSON.parse(file.readRawComponent(ref.typeID, ref.componentIndex));
                if (value && typeof value === "object") values.push(value as Record<string, unknown>);
            } catch {
                // A component that cannot be read simply offers nothing to match on; the
                // composer reports it properly when it comes to write the node out.
            }
        }

        return { node, id: node.id, componentNames, componentTypes, values, sections: sectionsById.get(node.id) ?? new Set() };
    });
}

/** Every node the selector matches, in node order. */
export function selectNodes(selector: string, facts: NodeFacts[]): NodeFacts[] {
    const parsed = parseSelector(selector);
    return facts.filter(node => matches(node, parsed));
}
