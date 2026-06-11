import { CSSProperties } from "react";
import { StylePropertyKey } from "src/lib/constants";
import { DeviceTypes } from "src/providers/email-editor/editor-provider";

export type ResponsiveDefault = {
  [key in DeviceTypes]: string;
};
  
 export  type BaseStyleField = {
    key: keyof CSSProperties
    label: string;
    type: "input" | "select" | "color" | "tabs";
    defaultValue: string | ResponsiveDefault;
    tooltip?: string;
    options?: string[];
    units?: string[];
    group: string;
  };
  
export type GroupedStyleField = {
    key: keyof CSSProperties;
    label: string;
    type: "group" |  "input" | "select" | "color" | "tabs";
    group: string;
    properties?: Record<string, BaseStyleField>;
    tooltip?: string;
    defaultValue  :string |  ResponsiveDefault
    options?: string[];
    units?: string[];
  };
  
//  export type StyleField = GroupedStyleField |  BaseStyleField 