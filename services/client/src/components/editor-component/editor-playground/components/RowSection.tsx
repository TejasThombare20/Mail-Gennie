import React from 'react';
import clsx from "clsx";
import { v4 } from 'uuid';
import { GripVertical, Trash, Plus } from 'lucide-react';
import withEmailElement, { EmailElementProps, EmailElementContext } from '../hoc/withEmailElement';
import { defaultStyles, EditorBtns } from '../../../../lib/constants';
import { useEditor } from '../../../../providers/email-editor/editor-provider';
import Recursive from '../recursive';

interface RowSectionProps extends EmailElementProps, EmailElementContext {}

const RowSectionComponent = React.forwardRef<HTMLDivElement, RowSectionProps>(
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

    const handleDrop = (e: React.DragEvent) => {
      e.stopPropagation();
      const componentType = e.dataTransfer.getData("componentType") as EditorBtns;

      // Prevent container nesting in row sections
      if (componentType === "container") {
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
                  target: "sameTab"
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
                  fontWeight: "500"
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
      <div className="w-full flex justify-center items-center bg-gray-50 rounded-md">
        <div className="text-center py-12">
          <Plus size={24} className="text-gray-600 mx-auto mb-3" />
          <div className="text-gray-600 mb-2 font-medium">Drop components here</div>
          <div className="text-sm text-gray-500">
            Add text, images, buttons and more
          </div>
        </div>
      </div>
    );

    return (
      <div
        ref={ref}
        style={element.styles}
        className={clsx(
          "group relative w-full h-full transition-all flex flex-col",
          {
            "min-h-[200px]": isEmpty, // Ensure minimum height for empty sections
            "h-full": !isEmpty, // Full height when not empty
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

        {/* Content or Empty State */}
        {isEmpty && !isLiveMode ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="empty-state w-full">
              {emptyStateComponent || defaultEmptyState}
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col gap-2 p-2">
            {Array.isArray(element.content) &&
              element.content.map((childElement) => {
                const isChildSelected = state.editor.selectedElement.id === childElement.id;
                return (
                  <div
                    key={childElement.id}
                    className={clsx(
                      "w-full content-item group/content relative transition-all",
                      {
                        // Content hover behavior - only for non-selected content
                        // "hover:border hover:border-purple-300 hover:bg-purple-50/10": !isLiveMode && !isChildSelected,
                        // Content selection behavior - only for selected content
                        // "border-2 border-purple-500 bg-purple-50/20": isChildSelected && !isLiveMode,
                      }
                    )}
                  >
                    <Recursive element={childElement} />
                  </div>
                );
              })}
          </div>
        )}
      </div>
    );
  }
);

RowSectionComponent.displayName = 'RowSectionComponent';

export default withEmailElement(RowSectionComponent); 