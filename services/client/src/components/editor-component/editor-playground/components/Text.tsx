import React, { useEffect, useRef, useState } from 'react';
import clsx from "clsx";
import { Bold, Italic, Underline, Trash, Type, GripVertical } from 'lucide-react';
import withEmailElement, { EmailElementProps, EmailElementContext } from '../hoc/withEmailElement';
import { useEditor } from '../../../../providers/email-editor/editor-provider';

interface TextComponentProps extends EmailElementProps, EmailElementContext {}

const TextComponent = React.forwardRef<HTMLDivElement, TextComponentProps>(
  (props, ref) => {
    const {
      element,
      isSelected,
      isLiveMode,
      isEmpty,
      handleClick,
      handleDelete,
      handleDragStart,
      className,
      ...restProps
    } = props;

    const { dispatch } = useEditor();
    const textRef = useRef<HTMLSpanElement>(null);
    const [isEditing, setIsEditing] = useState(false);

    const isTextEmpty = 
      (!Array.isArray(element.content) && !element.content?.innerText) ||
      (!Array.isArray(element.content) && element.content?.innerText?.trim() === '');

    useEffect(() => {
      if (isEditing && textRef.current && !isLiveMode) {
        textRef.current.focus();
      }
    }, [isEditing, isLiveMode]);

    useEffect(() => {
      if (!isSelected) {
        setIsEditing(false);
      }
    }, [isSelected]);

    const handleTextClick = (e: React.MouseEvent) => {
      handleClick(e);
      if (!isLiveMode) {
        setIsEditing(true);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLSpanElement>) => {
      const spanElement = e.target as HTMLSpanElement;
      dispatch({
        type: "UPDATE_ELEMENT",
        payload: {
          elementDetails: {
            ...element,
            content: {
              innerText: spanElement.innerText,
            },
          },
        },
      });
      setIsEditing(false);
    };

    const emptyStateComponent = (
      <div className="w-full flex border border-blue-400 flex-col justify-center items-center p-4 gap-2 bg-blue-50/30 rounded min-h-12">
        <Type size={16} className="text-blue-600" />
        <span className="text-blue-600 text-sm">Click to add text</span>
      </div>
    );

    return (
      <div
        ref={ref}
        style={element.styles}
        className={clsx(
          "relative w-full max-w-[70%] mx-auto min-h-8 transition-all cursor-text",
          {
            // Remove borders since they're handled by the content wrapper
            // "border border-purple-500": isSelected,
            // "hover:border hover:border-purple-300 hover:bg-purple-50/20": !isLiveMode && !isSelected,
          },
          className
        )}
        onClick={handleTextClick}
        onDragStart={handleDragStart}
        draggable={!isEditing && element.type !== "__body"}
        {...restProps}
      >
        {isTextEmpty && !isEditing && !isLiveMode ? (
          emptyStateComponent
        ) : (
          <span
            ref={textRef}
            className="focus:outline-none block p-2 w-full"
            contentEditable={!isLiveMode && isEditing}
            onBlur={handleBlur}
            suppressContentEditableWarning={true}
          >
            {!Array.isArray(element.content) && element.content.innerText}
          </span>
        )}

        {/* Formatting Toolbar - keep this as it's specific to text editing */}
        {isSelected && !isLiveMode && (
          <div className="absolute flex items-center gap-1 p-1 z-50 -bottom-8 right-0 bg-white border border-gray-200 rounded shadow-md">
            <button
              className="p-1 hover:bg-gray-100 rounded"
              onClick={(e) => {
                e.stopPropagation();
                // Handle bold formatting
                document.execCommand('bold');
              }}
            >
              <Bold size={14} />
            </button>
            <button
              className="p-1 hover:bg-gray-100 rounded"
              onClick={(e) => {
                e.stopPropagation();
                document.execCommand('italic');
              }}
            >
              <Italic size={14} />
            </button>
            <button
              className="p-1 hover:bg-gray-100 rounded"
              onClick={(e) => {
                e.stopPropagation();
                document.execCommand('underline');
              }}
            >
              <Underline size={14} />
            </button>
            <div className="w-px h-4 bg-gray-200 mx-1"></div>
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

TextComponent.displayName = 'TextComponent';

export default withEmailElement(TextComponent); 