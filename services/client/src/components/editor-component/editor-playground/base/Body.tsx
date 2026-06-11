import clsx from "clsx";
import React, { useEffect, useRef } from "react";
import { v4 } from "uuid";
import Recursive from "../recursive";
import {
  EditorElement,
  useEditor,
} from "../../../../providers/email-editor/editor-provider";
import { defaultStyles, EditorBtns } from "../../../../lib/constants";

type Props = { element: EditorElement };

const Body = ({ element }: Props) => {
  const { id, content, name, styles, type } = element;
  const { dispatch, state } = useEditor();
  const initializedRef = useRef(false);

  // Create initial empty row if body is empty - but only once
  useEffect(() => {
    const isEmpty = Array.isArray(content) && content.length === 0;
    if (isEmpty && !state.editor.liveMode && !initializedRef.current) {
      initializedRef.current = true;
      dispatch({
        type: "ADD_ELEMENT",
        payload: {
          containerId: id,
          elementDetails: {
            content: [],
            id: v4(),
            name: "Row",
            styles: { ...defaultStyles },
            type: "container",
          },
        },
      });
    }
  }, [id, content, state.editor.liveMode, dispatch]);

  const handleOnDrop = (e: React.DragEvent, type: string) => {
    e.stopPropagation();
    const componentType = e.dataTransfer.getData("componentType") as EditorBtns;

    console.log("componentType", componentType);

    // Create a new row when components are dropped on body
    const rowId = v4();

    switch (componentType) {
      case "container":
        // Just create an empty row (prevent row-under-row by only allowing this)
        dispatch({
          type: "ADD_ELEMENT",
          payload: {
            containerId: id,
            elementDetails: {
              content: [],
              id: rowId,
              name: "Row",
              styles: { ...defaultStyles },
              type: "container",
            },
          },
        });
        break;
      case "text":
        // Create row with text component directly
        dispatch({
          type: "ADD_ELEMENT",
          payload: {
            containerId: id,
            elementDetails: {
              content: [{
                content: { innerText: "Text Element" },
                id: v4(),
                name: "Text",
                styles: { ...defaultStyles, color: "black" },
                type: "text",
              }],
              id: rowId,
              name: "Row",
              styles: { ...defaultStyles },
              type: "container",
            },
          },
        });
        break;
      case "link":
        // Create row with link component directly
        dispatch({
          type: "ADD_ELEMENT",
          payload: {
            containerId: id,
            elementDetails: {
              content: [{
                content: { innerText: "Link Element", href: "#" },
                id: v4(),
                name: "Link",
                styles: { ...defaultStyles, color: "black" },
                type: "link",
              }],
              id: rowId,
              name: "Row",
              styles: { ...defaultStyles },
              type: "container",
            },
          },
        });
        break;
      case "divider":
        // Create row with divider component directly
        dispatch({
          type: "ADD_ELEMENT",
          payload: {
            containerId: id,
            elementDetails: {
              content: [{
                content: {},
                id: v4(),
                name: "Divider",
                styles: { ...defaultStyles },
                type: "divider",
              }],
              id: rowId,
              name: "Row",
              styles: { ...defaultStyles },
              type: "container",
            },
          },
        });
        break;
      default:
        // For other components, create row with component directly
        if (componentType) {
          dispatch({
            type: "ADD_ELEMENT",
            payload: {
              containerId: id,
              elementDetails: {
                content: [{
                  content: {},
                  id: v4(),
                  name: componentType,
                  styles: { ...defaultStyles },
                  type: componentType,
                }],
                id: rowId,
                name: "Row",
                styles: { ...defaultStyles },
                type: "container",
              },
            },
          });
        }
        break;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragStart = (e: React.DragEvent, type: string) => {
    if (type === "__body") return;
    e.dataTransfer.setData("componentType", type);
  };

  const handleOnClickBody = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Only update selected element if clicking on empty area (target is the body itself)
    if (e.target === e.currentTarget) {
      dispatch({
        type: "CHANGE_CLICKED_ELEMENT",
        payload: {},
      });
    } else {
      dispatch({
        type: "CHANGE_CLICKED_ELEMENT",
        payload: {
          elementDetails: element,
        },
      });
    }
  };

  const isSelectedElement =
    state.editor.selectedElement.id === id && !state.editor.liveMode;
  const isEmpty = Array.isArray(content) && content.length === 0;

  return (
    <div
      style={styles}
      className={clsx("relative py-4 px-3 transition-all group min-h-screen", {
        "h-full": true,
        "overflow-auto": type === "__body",
        "border-2 border-yellow-400": isSelectedElement && type === "__body",
        "border border-dashed border-gray-300 hover:border-blue-300":
          !state.editor.liveMode && !isSelectedElement,
        "bg-gray-50": type === "__body",
      })}
      onDrop={(e) => handleOnDrop(e, id)}
      onDragOver={handleDragOver}
      draggable={type !== "__body"}
      onClick={handleOnClickBody}
      onDragStart={(e) => handleDragStart(e, "container")}
    >
      {Array.isArray(content) &&
        content.map((childElement) => (
          <Recursive key={childElement.id} element={childElement} />
        ))}
    </div>
  );
};

export default Body;
