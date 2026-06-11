import { useState, useEffect } from "react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui-component/Dialog";
import { ScrollArea } from "./ui-component/Scroll-Area";
import { getNewSignedUrl } from "../handlers/mediaStorage";
import { Attachment } from "../types/attachment.type";
import PdfRender from "./Pdf-renderer";
import apiHandler, { ApiError } from "../handlers/api-handler";
import ErrorState from "./Error-state";
import LoadingState from "./Loading-state";
import { useHandleApiError } from "../handlers/useErrorToast";
import { useSuccessToast } from "../handlers/use-success-toast";

interface AttachmentViewerProps {
  isOpen: boolean;
  onClose?: () => void;
  attachment: Attachment;
}

const AttachmentViewer = ({
  isOpen,
  onClose,
  attachment,
}: AttachmentViewerProps) => {
  const showErrorToast = useHandleApiError();

  const [fileUrl, setFileUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isErrror, setIsErrror] = useState(false);

  useEffect(() => {
    const checkAndGetUrl = async () => {
      if (!attachment) return;
      try {
        setIsLoading(true);
        const isExpired = new Date(attachment.expires_at!) < new Date();

        if (isExpired && attachment.id) {
          const attachmentResponse = await apiHandler.get<Attachment>(
            `/api/files/attachment/${attachment.id}`
          );
          setFileUrl(attachmentResponse.data?.file_url!);
        } else {
          setFileUrl(attachment?.file_url);
        }
        setIsLoading(false);
      } catch (error) {
        setIsLoading(false);
        setIsErrror(true);
        showErrorToast(error as ApiError);
        console.error("Error getting new signed URL:", error);
      }
    };

    checkAndGetUrl();
  }, [attachment]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl min-h-full">
        {!attachment || isErrror ? (
          <ErrorState message="Failed to load attachment.Please retry or contact your administrator" />
        ) : isLoading ? (
          <LoadingState />
        ) : (
          fileUrl && (
            <>
              <DialogHeader>
                <DialogTitle>{attachment?.file_name}</DialogTitle>
              </DialogHeader>
              <ScrollArea className="h-full w-full overflow-y-scroll">
                <PdfRender url={fileUrl} />
              </ScrollArea>
            </>
          )
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AttachmentViewer;
