import React from "react";
import { ComponentButton } from "src/components/editor-component/editor-sidebar/style-pannels/helper/ComponentButton";
import { COMPONENT_BUTTONS } from "src/lib/constants";

const ComponentTabContent = () => {
  const handleDragStart = (e: React.DragEvent, componentType: string) => {
    console.log("componentDragStart-componentType", componentType);
    e.dataTransfer.setData("componentType", componentType);
  };

  return (
    <div className="grid grid-cols-3 gap-2 p-4">
      {COMPONENT_BUTTONS.map(({ name, icon, type }) => (
        <ComponentButton
          key={type}
          name={name}
          icon={icon}
          onDragStart={(e) => handleDragStart(e, type)}
        />
      ))}
    </div>
  );
};

export default ComponentTabContent;
