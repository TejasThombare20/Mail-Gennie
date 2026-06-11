import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { receiver_emails } from "../types/email-logs";
import { CSSProperties } from "react";
import { EditorState, useEditor } from "src/providers/email-editor/editor-provider";
import { STYLE_PROPERTIES, StylePropertyKey } from "./constants";
import { GroupedStyleField } from "src/types/editor-styling-types";


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Replaces {{key}} placeholders in `text` with values from the supplied
 * variable arrays (later arrays win on key collisions, so local vars override
 * global ones). Any remaining/empty placeholders are stripped and the
 * surrounding whitespace/punctuation tidied — mirroring the server's cleanup so
 * the UI shows the same final text the recipient saw.
 */
export const resolveTemplateText = (
  text: string,
  ...variableSets: Array<Array<{ key: string; value?: string }> | undefined>
): string => {
  if (!text) return text;

  // Build a key→value map; later sets override earlier ones.
  const values: Record<string, string> = {};
  for (const set of variableSets) {
    for (const v of set ?? []) {
      if (v && v.key) values[v.key] = v.value ?? "";
    }
  }

  let out = text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) =>
    values[key] !== undefined ? values[key] : ""
  );

  // Tidy: trim spaces before punctuation, collapse runs of whitespace.
  out = out.replace(/\s+([,.!?;:])/g, "$1").replace(/\s{2,}/g, " ").trim();
  return out;
};

export const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export const calculateSuccessRate = (receivers: receiver_emails[]) => {
  const total = receivers.length;
  if (total === 0) return { rate: 0, successful: 0, total: 0 };

  const successful = receivers.filter((r) => r.status === "sent").length;
  const rate = (successful / total) * 100;

  return { rate, successful, total };
};

export const getStyleValueForSelectedElement = (
  styleBlock: GroupedStyleField, state  :EditorState
) => {
  const deviceType = state.editor.device;
  const defaultValue =  styleBlock.defaultValue
  const newDefaultValue = typeof defaultValue === "string" ? defaultValue : defaultValue[deviceType]

    return state.editor.selectedElement.styles[styleBlock.key] ?? newDefaultValue;

};
