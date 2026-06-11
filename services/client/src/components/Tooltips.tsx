import React, { ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui-component/Tooltip";
import { Button } from "./ui-component/Button";
import { Info } from "lucide-react";

type TooltipsProps = {
  description: string,
  icon : ReactNode,
};

const TooltipNote = ({description , icon}: TooltipsProps) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button"  variant="outline" size="icon" className="h-5 w-5 hover:bg-transparent/5 bg-transparent">
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent className="w-[200px]" >
          {description}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default TooltipNote;
