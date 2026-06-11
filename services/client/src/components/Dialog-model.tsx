import React, { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui-component/Dialog";

type Props = {
  isOpen: boolean;
  onClose:  React.Dispatch<React.SetStateAction<boolean>>;
  TriggerElement: ReactNode;
  DialogSizeClass: string;
  title: string;
  description: string;
  children: ReactNode;
};

const DialogModel = ({
isOpen,
onClose,
  TriggerElement,
  title,
  description,
  children,
  DialogSizeClass
}: Props) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose} >
      <DialogTrigger asChild>{TriggerElement}</DialogTrigger>
      <DialogContent className={DialogSizeClass}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
    
      </DialogContent>
    </Dialog>
  );
};

export default DialogModel;
