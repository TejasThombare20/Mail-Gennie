import React, { useState } from "react";
import clsx from "clsx";
import { v4 } from "uuid";
import { GripVertical, Trash, Plus } from "lucide-react";
import withEmailElement, {
  EmailElementProps,
  EmailElementContext,
} from "../hoc/withEmailElement";
import { defaultStyles, EditorBtns } from "../../../../lib/constants";
import { useEditor } from "../../../../providers/email-editor/editor-provider";
import Recursive from "../recursive";

interface RowProps extends EmailElementProps, EmailElementContext {}

const RowComponent = React.forwardRef<HTMLDivElement, RowProps>(
  (props, ref) => {
    const {
      element,
      isSelected,
      isLiveMode,
      isEmpty,
      handleClick,
      handleDelete,
      handleDragStart,
      handleDragOver,
      className,
      emptyStateComponent,
      ...restProps
    } = props;

    const { dispatch, state } = useEditor();

    // Check if this is a child row (nested inside another row)
    const isChildRow = element.isChildRow || false;

    const handleDrop = (e: React.DragEvent) => {
      e.stopPropagation();
      const componentType = e.dataTransfer.getData(
        "componentType"
      ) as EditorBtns;

      // Prevent row-under-row nesting for child rows
      if (componentType === "container" && isChildRow) {
        return;
      }

      switch (componentType) {
        case "text":
          dispatch({
            type: "ADD_ELEMENT",
            payload: {
              containerId: element.id,
              elementDetails: {
                content: { innerText: "Text Element" },
                id: v4(),
                name: "Text",
                styles: { ...defaultStyles, color: "black" },
                type: "text",
              },
            },
          });
          break;
        case "link":
          dispatch({
            type: "ADD_ELEMENT",
            payload: {
              containerId: element.id,
              elementDetails: {
                content: { innerText: "Link Element", href: "#" },
                id: v4(),
                name: "Link",
                styles: { ...defaultStyles, color: "black" },
                type: "link",
              },
            },
          });
          break;
        case "divider":
          dispatch({
            type: "ADD_ELEMENT",
            payload: {
              containerId: element.id,
              elementDetails: {
                content: {},
                id: v4(),
                name: "Divider",
                styles: { ...defaultStyles },
                type: "divider",
              },
            },
          });
          break;
        case "button":
          dispatch({
            type: "ADD_ELEMENT",
            payload: {
              containerId: element.id,
              elementDetails: {
                content: {
                  innerText: "Button",
                  actionType: "website",
                  url: "#",
                  target: "sameTab",
                },
                id: v4(),
                name: "Button",
                styles: {
                  ...defaultStyles,
                  backgroundColor: "#007bff",
                  color: "#ffffff",
                  padding: "12px 24px",
                  borderRadius: "4px",
                  borderStyle: "none",
                  textAlign: "center",
                  fontSize: "16px",
                  fontWeight: "500",
                },
                type: "button",
              },
            },
          });
          break;
        default:
          if (componentType) {
            dispatch({
              type: "ADD_ELEMENT",
              payload: {
                containerId: element.id,
                elementDetails: {
                  content: {},
                  id: v4(),
                  name: componentType,
                  styles: { ...defaultStyles },
                  type: componentType,
                },
              },
            });
          }
          break;
      }
    };

    const defaultEmptyState = (
      <div className="w-full flex justify-center items-center border-2 border-dashed border-blue-400 bg-blue-50 rounded-md">
        <div className="text-center py-12">
          <Plus size={24} className="text-blue-600 mx-auto mb-3" />
          <div className="text-blue-600 mb-2 font-medium">
            Drop components here
          </div>
          <div className="text-sm text-gray-500">
            Add text, images, buttons and more
          </div>
        </div>
      </div>
    );

    // Check if this row has vertical divisions (sections)
    const hasVerticalDivisions =
      Array.isArray(element.content) &&
      element.content.some(
        (child) => child.type === "container" && child.name === "row-section"
      );

    return (
      <div
        ref={ref}
        style={element.styles}
        className={clsx(
          "group relative w-full transition-all mb-4",
          {
            // Row hover behavior - only when not hovering on content and not in live mode
            "hover:border hover:border-blue-500 hover:bg-blue-50/10":
              !isLiveMode,
            // Cancel row hover when hovering over content
            "has-[.content-item:hover]:border-0 has-[.content-item:hover]:bg-transparent":
              !isLiveMode,
            // Cancel row hover when hovering over empty state
            "has-[.empty-state:hover]:border-0 has-[.empty-state:hover]:bg-transparent":
              !isLiveMode,
            // Selection behavior for row
            "border border-blue-500 bg-blue-50/10": isSelected && !isLiveMode,
            "min-h-24": isEmpty,
            "min-h-[200px]": hasVerticalDivisions, // Minimum height for partitioned rows
            "h-auto": !isEmpty,
            "py-2": !isEmpty,
          },
          className
        )}
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
        draggable={false}
        {...restProps}
      >
        {/* Row Label - show on row hover or selection, but hide when content is hovered */}
        {!isLiveMode && (
          <div
            className={clsx(
              "absolute left-0 top-0 bg-blue-500 text-white text-xs py-1 px-2 rounded-br z-10 transition-opacity",
              {
                // Default: hidden
                "opacity-0": true,
                // Show on row hover - but hide when content or empty state is hovered
                "group-hover:opacity-100 group-has-[.content-item:hover]:opacity-0 group-has-[.empty-state:hover]:opacity-0": !isSelected && !isLiveMode,
                // Show when selected (overrides all other states)
                "!opacity-100": isSelected && !isLiveMode,
              }
            )}
          >
            {isChildRow ? "Row Section" : "Row"}
          </div>
        )}

        {/* Row Drag Handle - show on row hover or selection, but hide when content is hovered */}
        {!isLiveMode && element.type !== "__body" && (
          <div
            className={clsx(
              "absolute right-2 top-2 bg-blue-500 p-1 text-white rounded shadow-sm cursor-grab z-10 opacity-0 transition-opacity",
              "group-hover:opacity-100", 
              "group-has-[.content-item:hover]:opacity-0",
              "group-has-[.empty-state:hover]:opacity-0", 
              { "opacity-100": isSelected } 
            )}
            onMouseDown={() => {
              (ref as React.RefObject<HTMLDivElement>)?.current?.setAttribute(
                "draggable",
                "true"
              );
            }}
            onMouseUp={() => {
              (ref as React.RefObject<HTMLDivElement>)?.current?.setAttribute(
                "draggable",
                "false"
              );
            }}
          >
            <GripVertical size={16} />
          </div>
        )}

        {/* Content or Empty State */}
        {isEmpty && !isLiveMode ? (
          <div className={isChildRow ? "w-full" : "max-w-[70%] mx-auto"}>
            <div className="empty-state">
              {emptyStateComponent || defaultEmptyState}
            </div>
          </div>
        ) : hasVerticalDivisions ? (
          // Render horizontal sections (side by side) with visual separators
          <div className="w-full flex flex-row h-full min-h-[200px] relative">
            {Array.isArray(element.content) &&
              element.content.map((section, index) => {
                if (
                  section.type === "container" &&
                  section.name === "row-section"
                ) {
                  return (
                    <React.Fragment key={section.id}>
                      <div className="flex-1 h-full" style={{ width: section.styles?.width || 'auto' }}>
                        <Recursive element={section} />
                      </div>
                      {/* Vertical dotted separator between sections */}
                      {index < (Array.isArray(element.content) ? element.content.length : 0) - 1 && (
                        <div className="w-0 h-full relative flex items-center justify-center">
                          <div 
                            className="w-0 h-full border-l-2 border-dotted border-blue-400"
                            style={{ 
                              position: 'absolute',
                              top: '0',
                              bottom: '0',
                              left: '0'
                            }}
                          />
                        </div>
                      )}
                    </React.Fragment>
                  );
                }
                return null;
              })}
          </div>
        ) : (
          // Render normal row content
          <div className={clsx("w-full flex flex-col gap-2 p-2")}>
            {Array.isArray(element.content) &&
              element.content.map((childElement) => {
                const isChildSelected =
                  state.editor.selectedElement.id === childElement.id;
                return (
                  <div
                    key={childElement.id}
                    className={clsx(
                      "content-item group/content relative transition-all",
                      {
                        // For child rows, content takes full width, otherwise 70%
                        "w-full": isChildRow,
                        "w-[70%] mx-auto": !isChildRow,
                        // Content hover behavior - only for non-selected content
                        "hover:border hover:border-purple-300 hover:bg-purple-50/10":
                          !isLiveMode && !isChildSelected,
                        // Content selection behavior - only for selected content
                        "border-2 border-purple-500 bg-purple-50/20":
                          isChildSelected && !isLiveMode,
                      }
                    )}
                  >
                    {/* Content Label - show on content hover or when selected */}
                    {!isLiveMode && (
                      <div
                        className={clsx(
                          "absolute left-0 top-0 bg-purple-500 text-white text-xs py-1 px-2 rounded-br z-20 opacity-0 transition-opacity",
                          "group-hover/content:opacity-100", // Show on content hover
                          { "opacity-100": isChildSelected } // Show when content is selected
                        )}
                      >
                        Content
                      </div>
                    )}

                    {/* Content Drag Handle - show on content hover or when selected */}
                    {!isLiveMode && (
                      <div
                        className={clsx(
                          "absolute right-2 top-2 bg-purple-500 p-1 text-white rounded shadow-sm cursor-grab z-20 opacity-0 transition-opacity",
                          "group-hover/content:opacity-100", // Show on content hover
                          { "opacity-100": isChildSelected } // Show when content is selected
                        )}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const contentElement = e.currentTarget.parentElement;
                          contentElement?.setAttribute("draggable", "true");
                        }}
                        onMouseUp={(e) => {
                          const contentElement = e.currentTarget.parentElement;
                          contentElement?.setAttribute("draggable", "false");
                        }}
                      >
                        <GripVertical size={16} />
                      </div>
                    )}

                    <Recursive element={childElement} />
                  </div>
                );
              })}
          </div>
        )}

        {/* Action Buttons - show only when row is selected */}
        {isSelected && element.type !== "__body" && !isLiveMode && (
          <div className="absolute flex items-center gap-1 p-1 -bottom-8 right-2 bg-white border border-gray-200 rounded shadow-md z-50">
            <button
              className="p-1 hover:bg-red-100 text-red-500 rounded"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
            >
              <Trash size={14} />
            </button>
          </div>
        )}
      </div>
    );
  }
);

RowComponent.displayName = "RowComponent";

export default withEmailElement(RowComponent);
