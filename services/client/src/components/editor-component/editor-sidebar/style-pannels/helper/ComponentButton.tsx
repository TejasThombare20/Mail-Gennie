
import { motion } from "framer-motion";
import { HTMLMotionProps } from "framer-motion";

interface ComponentButtonProps {
    name: string;
    icon: React.ReactNode;
    onDragStart: (e: React.DragEvent) => void;
  }

export const ComponentButton = ({ name, icon, onDragStart } : ComponentButtonProps) => {
    return (
      <motion.div
        className="flex flex-col items-center justify-center p-3 border rounded-md hover:bg-muted transition-colors cursor-pointer"
        draggable
        onDragStartCapture={onDragStart}
        whileHover={{
          x: [0, -2, 2, -2, 2, 0],
          rotate: [0, 1, -1, 1, -1, 0],
          scale: 1.1,
          transition: { duration: 0.4 }
        }}
      >
        <div className="mb-1">{icon}</div>
        <span className="text-xs">{name}</span>
      </motion.div>
    );
  };