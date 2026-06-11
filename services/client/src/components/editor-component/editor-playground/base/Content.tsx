import React from 'react';
import clsx from "clsx";
import { v4 } from 'uuid';
import withEmailElement, { EmailElementProps, EmailElementContext } from '../hoc/withEmailElement';
import { defaultStyles, EditorBtns } from '../../../../lib/constants';
import { useEditor } from '../../../../providers/email-editor/editor-provider';
import Recursive from '../recursive';

interface ContentProps extends EmailElementProps, EmailElementContext {}

const ContentComponent = React.forwardRef<HTMLDivElement, ContentProps>(
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

    const { dispatch } = useEditor();

    const handleDrop = (e: React.DragEvent) => {
      e.stopPropagation();
      const componentType = e.dataTransfer.getData("componentType") as EditorBtns;

      const commonElementProps = {
        id: v4(),
        styles: { ...defaultStyles, color: "black" },
      };

      switch (componentType) {
        case "text":
          dispatch({
            type: "ADD_ELEMENT",
            payload: {
              containerId: element.id,
              elementDetails: {
                ...commonElementProps,
                content: { innerText: "Text Element" },
                name: "Text",
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
                ...commonElementProps,
                content: { innerText: "Link Element", href: "#" },
                name: "Link",
                type: "link",
              },
            },
          });
          break;
        case "container":
          dispatch({
            type: "ADD_ELEMENT",
            payload: {
              containerId: element.id,
              elementDetails: {
                ...commonElementProps,
                content: [],
                name: "Container",
                type: "container",
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
                ...commonElementProps,
                content: {},
                name: "Divider",
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
                ...commonElementProps,
                content: { 
                  innerText: "Button",
                  actionType: "website",
                  url: "#",
                  target: "sameTab"
                },
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
        // Add more component types as needed
        default:
          break;
      }
    };

    const defaultEmptyState = (
      <div className="w-full h-full flex justify-center items-center border border-dashed border-blue-400 bg-blue-50/50 rounded min-h-16">
        <div className="text-center py-4 px-6">
          <div className="text-blue-600 text-sm mb-1 font-medium">Drop elements here</div>
          <div className="text-xs text-gray-500">
            Text, Images, Buttons, etc.
          </div>
        </div>
      </div>
    );

    return (
      <div
        ref={ref}
        style={element.styles}
        className={clsx(
          "relative h-full transition-all",
          {
            "border border-blue-400": isSelected && !isLiveMode,
            "hover:border hover:border-blue-300": !isLiveMode && !isSelected,
            "min-h-16": isEmpty,
            "p-2": !isEmpty || isLiveMode,
            "w-[70%]": true, // Always 70% width of parent row
          },
          className
        )}
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
        draggable={element.type !== "__body"}
        {...restProps}
      >
        {/* Content Label */}
        {!isLiveMode && isSelected && (
          <div className="absolute left-0 top-0 bg-green-500 text-white text-xs py-1 px-2 rounded-br opacity-90 z-10">
            {element.name || "Content"}
          </div>
        )}

        {isEmpty && !isLiveMode ? (
          emptyStateComponent || defaultEmptyState
        ) : (
          <div className="w-full h-full">
            {Array.isArray(element.content) &&
              element.content.map((childElement) => (
                <Recursive key={childElement.id} element={childElement} />
              ))}
          </div>
        )}
      </div>
    );
  }
);

ContentComponent.displayName = 'ContentComponent';

export default withEmailElement(ContentComponent); 