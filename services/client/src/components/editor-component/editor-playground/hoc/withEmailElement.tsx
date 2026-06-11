import React from 'react';
import { EditorElement, useEditor } from '../../../../providers/email-editor/editor-provider';

export interface EmailElementProps {
  element: EditorElement;
  children?: React.ReactNode;
  className?: string;
  allowDrop?: boolean;
  showEmptyState?: boolean;
  emptyStateComponent?: React.ReactNode;
}

export interface EmailElementContext {
  element: EditorElement;
  isSelected: boolean;
  isLiveMode: boolean;
  isEmpty: boolean;
  handleClick: (e: React.MouseEvent) => void;
  handleDelete: () => void;
  handleDragStart: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
}

const withEmailElement = <P extends EmailElementProps>(
  WrappedComponent: React.ComponentType<P & EmailElementContext>
) => {
  return React.forwardRef<HTMLDivElement, P>((props, ref) => {
    const { element, allowDrop = true, showEmptyState = true, ...restProps } = props;
    const { dispatch, state } = useEditor();

    const isSelected = state.editor.selectedElement.id === element.id && !state.editor.liveMode;
    const isLiveMode = state.editor.liveMode;
    const isEmpty = Array.isArray(element.content) && element.content.length === 0;

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      dispatch({
        type: "CHANGE_CLICKED_ELEMENT",
        payload: { elementDetails: element },
      });
    };

    const handleDelete = () => {
      dispatch({
        type: "DELETE_ELEMENT",
        payload: { elementDetails: element },
      });
    };

    const handleDragStart = (e: React.DragEvent) => {
      if (element.type === "__body") return;
      e.dataTransfer.setData("componentType", element?.type || "");
    };

    const handleDragOver = (e: React.DragEvent) => {
      if (!allowDrop) return;
      e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent) => {
      if (!allowDrop) return;
      e.stopPropagation();
      // This will be handled by specific components
    };

    const context: EmailElementContext = {
      element,
      isSelected,
      isLiveMode,
      isEmpty,
      handleClick,
      handleDelete,
      handleDragStart,
      handleDrop,
      handleDragOver,
    };

    return (
      <WrappedComponent
        ref={ref}
        {...(restProps as unknown as P)}
        {...context}
      />
    );
  });
};

export default withEmailElement; 