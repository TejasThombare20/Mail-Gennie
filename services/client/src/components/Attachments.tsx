import React, { useEffect, useRef, useState } from "react";
import { Button } from "./ui-component/Button";
import {
  AlertCircle,
  Download,
  Eye,
  File,
  FilePlus,
  Files,
  FileText,
  Image,
  Loader2,
  RefreshCw,
  Search,
  Upload,
  X,
} from "lucide-react";
import { Attachment } from "../types/attachment.type";
import axios from "axios";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui-component/Card";
import { Input } from "./ui-component/Input";
import { Badge } from "./ui-component/Badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui-component/Dialog";
import { ScrollArea } from "./ui-component/Scroll-Area";
import { Tabs, TabsList, TabsTrigger } from "./ui-component/Tabs";
import { Progress } from "./ui-component/Progress";
import apiHandler, { ApiError } from "../handlers/api-handler";
import UploadAttachment from "./Upload-Attachment";
import PdfRender from "./Pdf-renderer";
import { useHandleApiError } from "../handlers/useErrorToast";
import { useSuccessToast } from "../handlers/use-success-toast";
import ErrorState from "./Error-state";
import LoadingState from "./Loading-state";
import EmptyState from "./Empty-State";
import AttachmentViewer from "./Attachment-Viewer";

type Props = {};

const Attachments = (props: Props) => {
  const showErrorToast = useHandleApiError();
  const showSuccessToast = useSuccessToast();

  const [attachments, setAttachments] = useState<Attachment[] | []>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, serIsError] = useState(false);
  const [viewAttachment, setViewAttachment] = useState<Attachment | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);  

  useEffect(() => {
    const fetchAttachments = async () => {
      setIsLoading(true);
      try {
        const response = await apiHandler.get<Attachment[]>(
          "/api/files/user/attachments"
        );
        console.log("responseData",response.data)
        setAttachments(response.data!);

        showSuccessToast("Attachment loaded successfully");
      } catch (error) {
        serIsError(true);
        showErrorToast(error as ApiError);
        console.error("Error fetching attachments:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAttachments();
  }, []);


  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    else return (bytes / 1048576).toFixed(1) + " MB";
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/"))
      return <Image className="h-8 w-8 text-blue-500" />;
    if (fileType === "application/pdf")
      return <FileText className="h-8 w-8 text-red-500" />;
    return <File className="h-8 w-8 text-gray-500" />;
  };


  return (
    <>
    <div className="w-full space-y-2 ">
      {isError ? (
        <ErrorState message="failed to load the attachments,Please retry or contact Administrator" />
      ) : isLoading ? (
        <LoadingState />
      ) :  !isLoading  && attachments?.length == 0 ? (
        <EmptyState
          description="No attachmnets uploaded yet, Please upload your first Attachment"
          title="No attachment found"
          icon={<Files />}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          { attachments?.length >=0 &&  attachments.map((attachment) => (
            <Card
              key={attachment.id}
              className="overflow-hidden hover:shadow-md transition-shadow"
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex justify-between items-center">
                  <span
                    className="truncate flex-1"
                    title={attachment.file_name}
                  >
                    {attachment?.file_name}
                  </span>
                  <Badge variant="outline" className="ml-2 flex-shrink-0">
                    {attachment?.file_type?.split("/")[1]}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="flex items-center gap-3">
                  {getFileIcon(attachment?.file_type)}
                  <div className="flex-1">
                    <div className="text-sm text-gray-500">
                      {formatFileSize(attachment?.file_size)}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(attachment.uploaded_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={()=> {
                    setIsDialogOpen(true)
                    setViewAttachment(attachment)
                  }}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
                {/* <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => window.open(attachment.file_url, "_blank")}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button> */}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>

    <AttachmentViewer
    attachment={viewAttachment!}
    isOpen={isDialogOpen}
    onClose={() => setIsDialogOpen(false)}
    />
    </>
  );
};

export default Attachments;
