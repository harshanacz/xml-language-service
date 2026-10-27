import type { SyntaxError } from "./xmlNode.js";
import { offsetToPosition } from "../utils/positionUtils.js";

const PREDEFINED_ENTITIES = new Set(["amp", "lt", "gt", "quot", "apos"]);
const ENTITY_DECL_RE = /<!ENTITY\s+([^\s%]+)/g;
const ATTR_ENTITY_RE = /&([A-Za-z_:][\w.:-]*);/g;

/**
 * Checks well-formedness rules that the fault-tolerant CST parser does not enforce:
 * end-tag names must match their start-tag, and named entity references must be
 * predefined or declared in the document's DOCTYPE.
 */
export function collectWellFormednessErrors(cst: any, text: string): SyntaxError[] {
  const errors: SyntaxError[] = [];
  const known = new Set(PREDEFINED_ENTITIES);
  for (const m of text.matchAll(ENTITY_DECL_RE)) known.add(m[1]);

  const report = (message: string, start: number, end: number): void => {
    const s = offsetToPosition(text, start);
    const e = offsetToPosition(text, end);
    errors.push({ message, line: s.line, character: s.character, endLine: e.line, endCharacter: e.character });
  };

  const checkEntity = (name: string, start: number, end: number): void => {
    if (!known.has(name)) report(`entity '${name}' not found`, start, end);
  };

  const visitElement = (element: any): void => {
    const children = element?.children ?? {};
    const open = children.Name?.[0];
    const close = children.END_NAME?.[0];
    if (open && close && open.image !== close.image) {
      report(
        `expected end of tag '${open.image}' but found '${close.image}'`,
        close.startOffset,
        close.endOffset + 1
      );
    }

    for (const attr of children.attribute ?? []) {
      const value = attr?.children?.STRING?.[0];
      if (!value) continue;
      for (const m of value.image.matchAll(ATTR_ENTITY_RE)) {
        const start = value.startOffset + m.index!;
        checkEntity(m[1], start, start + m[0].length);
      }
    }

    for (const content of children.content ?? []) {
      for (const ref of content?.children?.reference ?? []) {
        const token = ref?.children?.EntityRef?.[0];
        if (!token) continue;
        checkEntity(token.image.slice(1, -1), token.startOffset, token.endOffset + 1);
      }
      for (const child of content?.children?.element ?? []) visitElement(child);
    }
  };

  for (const root of cst?.children?.element ?? []) visitElement(root);
  return errors;
}
