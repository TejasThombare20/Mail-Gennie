import React from "react";
import { EditorElement } from "../../../providers/email-editor/editor-provider";

// Base components
import RowComponent from "./base/Row";

// Content components  
import TextComponent from "./components/Text";
import DividerComponent from "./components/Divider";
import ButtonComponent from "./components/Button";
import RowSectionComponent from "./components/RowSection";

// Legacy components (to be phased out)
import Body from "./base/Body";

interface RecursiveProps {
  element: EditorElement;
}

const Recursive: React.FC<RecursiveProps> = ({ element }) => {
  switch (element.type) {
    case "__body":
      return <Body element={element} />;
    
    case "container":
      // Check if this is a row-sectio
      if (element.name === "row-section") {
        return React.createElement(RowSectionComponent as any, { element });
      }
      // Check if this is a row-level container
      if (element.name === "Row" || element.name === "row") {
        return React.createElement(RowComponent as any, { element });
      }
    
    case "text":
      return React.createElement(TextComponent as any, { element });
    
    case "link":
      return React.createElement(TextComponent as any, { element });

    case "divider":
      return React.createElement(DividerComponent as any, { element });

    case "button":
      return React.createElement(ButtonComponent as any, { element });

    default:
      return null;
  }
};

export default Recursive;
