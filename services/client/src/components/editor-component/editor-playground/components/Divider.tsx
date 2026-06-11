import React from 'react';
import clsx from "clsx";
import { GripVertical, Trash, Minus } from 'lucide-react';
import withEmailElement, { EmailElementProps, EmailElementContext } from '../hoc/withEmailElement';

interface DividerComponentProps extends EmailElementProps, EmailElementContext {}

const DividerComponent = React.forwardRef<HTMLDivElement, DividerComponentProps>(
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

    const emptyStateComponent = (
      <div className="w-full flex border border-gray-400 flex-col justify-center items-center p-4 gap-2 bg-gray-50/30 rounded min-h-12">
        <Minus size={16} className="text-gray-600" />
        <span className="text-gray-600 text-sm">Divider</span>
      </div>
    );

    return (
      <div
        ref={ref}
        style={element.styles}
        className={clsx(
          "group relative w-full max-w-[70%] mx-auto min-h-8 transition-all",
          {
            // Selection border
            "border border-gray-500 bg-gray-50/20": isSelected && !isLiveMode,
            // Hover effect
            "hover:border hover:border-gray-300 hover:bg-gray-50/10": !isLiveMode && !isSelected,
          },
          className
        )}
        onClick={handleClick}
        onDragStart={handleDragStart}
        draggable={element.type !== "__body"}
        {...restProps}
      >
        {/* Component Label - show when selected or on hover */}
        {!isLiveMode && (
          <div
            className={clsx(
              "absolute left-0 top-0 bg-gray-500 text-white text-xs py-1 px-2 rounded-br z-10 opacity-0 transition-opacity",
              "group-hover:opacity-100", // Show on hover
              { "opacity-100": isSelected } // Show when selected
            )}
          >
            {element.name || "Divider"}
          </div>
        )}

        {/* Drag Handle - show when selected or on hover */}
        {!isLiveMode && element.type !== "__body" && (
          <div
            className={clsx(
              "absolute right-2 top-2 bg-gray-500 p-1 text-white rounded shadow-sm cursor-grab z-10 opacity-0 transition-opacity",
              "group-hover:opacity-100", // Show on hover
              { "opacity-100": isSelected } // Show when selected
            )}
            onMouseDown={() => {
              (ref as React.RefObject<HTMLDivElement>)?.current?.setAttribute('draggable', 'true');
            }}
            onMouseUp={() => {
              (ref as React.RefObject<HTMLDivElement>)?.current?.setAttribute('draggable', 'false');
            }}
          >
            <GripVertical size={16} />
          </div>
        )}

        {/* Divider Line */}
        {isLiveMode ? (
          <hr 
            className="w-full border-0 my-4"
            style={{
              borderTopWidth: element.styles?.borderTopWidth || '1px',
              borderTopStyle: 'solid',
              borderTopColor: element.styles?.borderTopColor || '#000000',
              width: element.styles?.width || '100%',
              ...element.styles
            }}
          />
        ) : (
          <div className="w-full p-2">
            <hr 
              className="border-0"
              style={{
                borderTopWidth: element.styles?.borderTopWidth || '1px',
                borderTopStyle: 'solid',
                borderTopColor: element.styles?.borderTopColor || '#000000',
                width: element.styles?.width || '100%',
                ...element.styles
              }}
            />
          </div>
        )}

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

DividerComponent.displayName = 'DividerComponent';

export default withEmailElement(DividerComponent); 