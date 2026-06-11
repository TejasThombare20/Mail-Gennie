import { useEffect, useState } from 'react';

/**
 * A custom hook that shows a warning when the user tries to leave a page with unsaved changes.
 * 
 * @param isDirty - Boolean indicating if there are unsaved changes
 * @param message - Optional message to display in the browser's confirmation dialog
 */
export function useUnsavedChangesWarning(
  isDirty: boolean,
  message: string = 'You have unsaved changes. Are you sure you want to leave this page?'
) {
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    // This handles the browser's built-in confirmation dialog
    // for page reloads, closing tabs, etc.
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      
      e.preventDefault();
      e.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty, message]);

  return { showDialog, setShowDialog };
} 