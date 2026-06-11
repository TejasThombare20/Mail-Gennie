import React from 'react';
import clsx from "clsx";
import { MousePointerClick, GripVertical, Trash } from 'lucide-react';
import withEmailElement, { EmailElementProps, EmailElementContext } from '../hoc/withEmailElement';

interface ButtonComponentProps extends EmailElementProps, EmailElementContext {}

const ButtonComponent = React.forwardRef<HTMLDivElement, ButtonComponentProps>(
  (props, ref) => {
    const {
      element,
      isSelected,
      isLiveMode,
      handleClick,
      handleDelete,
      handleDragStart,
      className,
      ...restProps
    } = props;

    // Get button properties from element content
    const buttonContent = !Array.isArray(element.content) ? element.content : null;
    const buttonText = buttonContent?.innerText !== undefined ? buttonContent.innerText : "Button";
    const actionType = buttonContent?.actionType || "website";
    const url = buttonContent?.url || "#";
    const target = buttonContent?.target || "sameTab";

    const handleButtonClick = (e: React.MouseEvent) => {
      if (isLiveMode) {
        e.stopPropagation();
        switch (actionType) {
          case "website":
            if (target === "newTab") {
              window.open(url, "_blank");
            } else {
              window.location.href = url;
            }
            break;
          case "email":
            window.location.href = `mailto:${url}`;
            break;
          case "phone":
            window.location.href = `tel:${url}`;
            break;
          default:
            break;
        }
      } else {
        handleClick(e);
      }
    };

    const emptyStateComponent = (
      <div className="w-full flex border border-blue-400 flex-col justify-center items-center p-4 gap-2 bg-blue-50/30 rounded min-h-12">
        <MousePointerClick size={16} className="text-blue-600" />
        <span className="text-blue-600 text-sm">Button</span>
      </div>
    );

    return (
      <div
        ref={ref}
        className={clsx("relative flex justify-center my-4", className)}
        onClick={!isLiveMode ? handleClick : undefined}
        onDragStart={handleDragStart}
        draggable={!isLiveMode && element.type !== "__body"}
        {...restProps}
      >
        <button
          style={{
            backgroundColor: element.styles?.backgroundColor || "#007bff",
            color: element.styles?.color || "#ffffff",
            width: element.styles?.width || "auto",
            lineHeight: element.styles?.lineHeight || "1.0",
            letterSpacing: element.styles?.letterSpacing || "normal",
            textAlign: element.styles?.textAlign || "center",
            padding: element.styles?.padding || "5px 10px",
            margin: element.styles?.margin || "0",
            borderStyle: element.styles?.borderStyle || "none",
            borderWidth: element.styles?.borderWidth || "0px",
            borderColor: element.styles?.borderColor || "transparent",
            borderRadius: element.styles?.borderRadius || "4px",
            fontSize: element.styles?.fontSize || "16px",
            fontWeight: element.styles?.fontWeight || "500",
            cursor: isLiveMode ? "pointer" : "default",
            display: "inline-block",
            minWidth: "auto",
            ...element.styles,
          }}
          className="transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          onClick={handleButtonClick}
          type="button"
          disabled={!isLiveMode}
        >
          {buttonText || "Button"}
        </button>

        {/* Action Buttons - show when selected */}
        {isSelected && element.type !== "__body" && !isLiveMode && (
          <div className="absolute flex items-center gap-1 p-1 -bottom-8 right-0 bg-white border border-gray-200 rounded shadow-md z-50">
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

ButtonComponent.displayName = 'ButtonComponent';

export default withEmailElement(ButtonComponent); 