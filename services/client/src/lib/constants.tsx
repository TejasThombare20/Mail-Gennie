import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Code,
  Columns2,
  Heading,
  Image,
  Menu,
  MousePointerClick,
  SeparatorHorizontal,
  Share2,
  Type,
} from "lucide-react";
import { GroupedStyleField } from "src/types/editor-styling-types";

export type EditorBtns =
  | "text"
  | "container"
  | "section"
  | "contactForm"
  | "paymentForm"
  | "link"
  | "2Col"
  | "video"
  | "__body"
  | "image"
  | "divider"
  | "button"
  | null
  | "3Col";

export const defaultStyles: React.CSSProperties = {
  backgroundPosition: "center",
  objectFit: "cover",
  backgroundRepeat: "no-repeat",
  textAlign: "left",
  opacity: "100%",
};

export const FONT_FAMILIES = [
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Times New Roman", value: "Times New Roman, serif" },
  { label: "Courier New", value: "Courier New, monospace" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Helvetica", value: "Helvetica, sans-serif" },
];

export const FONT_WEIGHTS = [
  { label: "Normal", value: "normal" },
  { label: "Bold", value: "bold" },
  { label: "100", value: "100" },
  { label: "200", value: "200" },
  { label: "300", value: "300" },
  { label: "400", value: "400" },
  { label: "500", value: "500" },
  { label: "600", value: "600" },
  { label: "700", value: "700" },
  { label: "800", value: "800" },
  { label: "900", value: "900" },
];

export const LETTER_SPACING = [
  { label: "Extra Tight", value: "-1" },
  { label: "Tight", value: "-0.5" },
  { label: "Standard", value: "0" },
  { label: "Slightly Wide", value: "0.5" },
  { label: "Wide", value: "1" },
  { label: "Extra Wide", value: "2" },
  { label: "Ultra Wide", value: "4" }
];

export const COMPONENT_BUTTONS = [
  { name: "Text", icon: <Type className="h-4 w-4" />, type: "text" },
  {name : "columns", icon: <Columns2  className="h-4 w-4"/> , type: "container"},
  {
    name: "Button",
    icon: <MousePointerClick className="h-4 w-4" />,
    type: "button",
  },
  {
    name: "Divider",
    icon: <SeparatorHorizontal className="h-4 w-4" />,
    type: "divider",
  },
  { name: "Image", icon: <Image className="h-4 w-4" />, type: "image" },
  { name: "Heading", icon: <Heading className="h-4 w-4" />, type: "heading" },
  { name: "Socials", icon: <Share2 className="h-4 w-4" />, type: "socials" },
  { name: "Menu", icon: <Menu className="h-4 w-4" />, type: "menu" },
  { name: "HTML", icon: <Code className="h-4 w-4" />, type: "html" },
];

export const BLOCK_LAYOUTS = [
  { name: "Two Columns (50/50)", columns: [50, 50] },
  { name: "Three Columns (33/33/33)", columns: [33, 33, 33] },
  { name: "Four Columns (25/25/25/25)", columns: [25, 25, 25, 25] },
  { name: "Two Columns (33/67)", columns: [33, 67] },
  { name: "Two Columns (67/33)", columns: [67, 33] },
  { name: "Single Column (100)", columns: [100] },
];

export const TEXT_ALIGN_OPTIONS = [
  { value: "left", icon: AlignLeft },
  { value: "center", icon: AlignCenter },
  { value: "right", icon: AlignRight },
  { value: "justify", icon: AlignJustify },
];

export const BORDER_STYLES = [
  { label: 'Solid', value: 'solid' },
  { label: 'Dotted', value: 'dotted' },
  { label: 'Dashed', value: 'dashed' },
  { label: 'None', value: 'none' },
];


export const COLUMN_LAYOUTS = [
  { label: '2 Sections (50/50)', value: '50-50', columns: ['50%', '50%'] },
  { label: '2 Sections (67/33)', value: '67-33', columns: ['67%', '33%'] },
  { label: '2 Sections (33/67)', value: '33-67', columns: ['33%', '67%'] },
  { label: '3 Sections (33/33/33)', value: '33-33-33', columns: ['33%', '33%', '33%'] },
  { label: '4 Sections (25/25/25/25)', value: '25-25-25-25', columns: ['25%', '25%', '25%', '25%'] },
  { label: '4 Sections (33/17/33/17)', value: '33-17-33-17', columns: ['33%', '17%', '33%', '17%'] },
];


export const STYLE_PROPERTY_KEYS = [
  "fontSize",
  "fontWeight",
  "color",
  "textAlign",
  "padding",
  "margin",
  "lineHeight",
  "backgroundColor",
  "borderRadius",
  "boxShadow",
] as const;

export type StylePropertyKey = (typeof STYLE_PROPERTY_KEYS)[number];

export const STYLE_PROPERTIES: Record<string, GroupedStyleField> = {
  // export const STYLE_PROPERTIES = {
  // Typography
  fontSize: {
    key: "fontSize",
    label: "Font Size",
    type: "input",
    defaultValue: { Desktop: "16", Tablet: "14", Mobile: "12" },
    units: ["px"],
    tooltip: "Controls the size of the text",
    group: "Typography",
  },
  fontFamily: {
    key: "fontFamily",
    label: "Font Family",
    type: "input",
    defaultValue: { Desktop: "Arial, sans-serif", Tablet: "Arial, sans-serif", Mobile: "Arial, sans-serif" },
    tooltip: "Set different style of the text",
    group: "Typography",
  },
  
  fontWeight: {
    key: "fontWeight",
    label: "Font Weight",
    type: "select",
    defaultValue: "normal",
    options: ["lighter", "normal", "bold"],
    tooltip: "Applies weight/thickness to the font",
    group: "Typography",
  },
  color: {
    key: "color",
    label: "Text Color",
    type: "color",
    defaultValue: "#000000",
    tooltip: "Sets the color of the text",
    group: "Typography",
  },
  textAlign: {
    key: "textAlign",
    label: "Text Align",
    type: "tabs",
    defaultValue: "left",
    options: ["left", "center", "right", "justify"],
    tooltip: "Aligns text within the element",
    group: "Typography",
  },
  lineHeight: {
    key: "lineHeight",
    label: "Line Height",
    type: "input",
    defaultValue: { Desktop: "1.5", Tablet: "1.4", Mobile: "1.3" },
    units: ["px"],
    tooltip: "Adjusts spacing between lines of text",
    group: "Typography",
  },
  letterSpacing: {
    key: "letterSpacing",
    label: "Letter Spacing",
    type: "input",
    defaultValue: { Desktop: "0.05", Tablet: "0.04em", Mobile: "0.03em" },
    units: ["px"],
    tooltip: "Adjusts spacing between letters",
    group: "Typography",
  },
  // Decorations
  backgroundColor: {
    key: "backgroundColor",
    label: "Background Color",
    type: "color",
    defaultValue: "#ffffff",
    tooltip: "Sets the background color of the block",
    group: "Decorations",
  },
  borderRadius: {
    key: "borderRadius",
    label: "Border Radius",
    type: "input",
    defaultValue: { Desktop: "0", Tablet: "0", Mobile: "0" },
    units: ["px"],
    tooltip: "Rounds the corners of the element",
    group: "Decorations",
  },
  boxShadow: {
    key: "boxShadow",
    label: "Box Shadow",
    type: "input",
    defaultValue: "",
    tooltip: "Applies shadow around the element",
    group: "Decorations",
  },

  // Spacing - Margin
  margin: {
    key: "margin",
    label: "Margin",
    type: "input",
    defaultValue: { Desktop: "4", Tablet: "3", Mobile: "2" },
    units: ["px"],
    group: "Spacing",
    tooltip: "Space from all side of the element",
  },
  marginTop: {
    key: "marginTop",
    label: "Top",
    type: "input",
    defaultValue: { Desktop: "4", Tablet: "3", Mobile: "2" },
    units: ["px"],
    tooltip: "Space above the element",
    group: "Spacing",
  },
  marginRight: {
    key: "marginRight",
    label: "Right",
    type: "input",
    defaultValue: { Desktop: "4", Tablet: "3", Mobile: "2" },
    units: ["px"],
    tooltip: "Space to the right of the element",
    group: "Spacing",
  },
  marginBottom: {
    key: "marginBottom",
    label: "Bottom",
    type: "input",
    defaultValue: { Desktop: "4", Tablet: "3", Mobile: "2" },
    units: ["px"],
    tooltip: "Space below the element",
    group: "Spacing",
  },
  marginLeft: {
    key: "marginLeft",
    label: "Left",
    type: "input",
    defaultValue: { Desktop: "4", Tablet: "3", Mobile: "2" },
    units: ["px"],
    tooltip: "Space to the left of the element",
    group: "Spacing",
  },

  // Spacing - Padding
  padding: {
    key: "padding",
    label: "Padding",
    type: "input",
    group: "Spacing",
    defaultValue: { Desktop: "10", Tablet: "8", Mobile: "6" },
    tooltip : "Space inside the all side of the element",
    units: ["px"]
    
  },
  paddingTop: {
    key: "paddingTop",
    label: "Top",
    type: "input",
    defaultValue: { Desktop: "10", Tablet: "8", Mobile: "6" },
    units: ["px"],
    tooltip: "Space inside the top of the element",
    group: "Spacing",
  },
  paddingRight: {
    key: "paddingRight",
    label: "Right",
    type: "input",
    defaultValue: { Desktop: "10", Tablet: "8", Mobile: "6" },
    units: ["px"],
    tooltip: "Space inside the right of the element",
    group: "Spacing",
  },
  paddingBottom: {
    key: "paddingBottom",
    label: "Bottom",
    type: "input",
    defaultValue: { Desktop: "10", Tablet: "8", Mobile: "6" },
    units: ["px"],
    tooltip: "Space inside the bottom of the element",
    group: "Spacing",
  },
  paddingLeft: {
    key: "paddingLeft",
    label: "Left",
    type: "input",
    defaultValue: { Desktop: "10", Tablet: "8", Mobile: "6" },
    units: ["px"],
    tooltip: "Space inside the left of the element",
    group: "Spacing",
  },
};
