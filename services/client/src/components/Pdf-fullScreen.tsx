import React, { useState } from "react";

import { Expand, Loader2 } from "lucide-react";
import { Document, Page } from "react-pdf";

import { useResizeDetector } from "react-resize-detector";
import { useToast } from "./ui-component/Use-toast";
import { Dialog, DialogContent, DialogTrigger } from "./ui-component/Dialog";
import { Button } from "./ui-component/Button";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import DialogModel from "./Dialog-model";

interface PdfFulScreenProps {
  fileUrl: string;
}

const PdfFullSecreen = ({ fileUrl }: PdfFulScreenProps) => {
  const { toast } = useToast();
  const { width, ref } = useResizeDetector();

  const [isOpen, setisOpen] = useState(false);
  const [numPages, setnumPages] = useState<number>();

  return (
      <DialogModel
        DialogSizeClass="max-w-7xl w-full"
        TriggerElement={
          <Button variant="ghost" onClick={(prev) => setisOpen(!prev)}>
            <Expand />
          </Button>
        }
        description="Attachment Full view"
        isOpen={isOpen}
        onClose={setisOpen}
        title="Full Screen attachment view"
      >
        <ScrollArea className="max-h-[calc(100vh-10rem)] mt-6 overflow-y-scroll">
          <div ref={ref}>
            <Document
              file={fileUrl}
              className="max-h-full "
              loading={
                <div className="flex justify-center ">
                  <Loader2 className="my-24 h-6 w-6 animate-spin" />
                </div>
              }
              onLoadError={() => {
                toast({
                  title: "Error loading PDF",
                  description: "Please try again later",
                  variant: "destructive",
                });
              }}
              onLoadSuccess={({ numPages }) => {
                setnumPages(numPages);
              }}
            >
              {new Array(numPages).fill(0).map((_, i) => (
                <Page key={i} width={width ? width : 1} pageNumber={i + 1} />
              ))}
            </Document>
          </div>
        </ScrollArea>
      </DialogModel>
  );
};

export default PdfFullSecreen;
