import { Attachment } from "../types/attachment.type";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "./ui-component/Sheet";
import { ScrollArea } from "./ui-component/Scroll-Area";
import { Checkbox } from "./ui-component/Checkbox";
import { File, FileText } from "lucide-react";
import apiHandler, { ApiError } from "../handlers/api-handler";
import { useEffect, useState } from "react";
import { useHandleApiError } from "../handlers/useErrorToast";
import { useSuccessToast } from "../handlers/use-success-toast";
import ErrorState from "./Error-state";
import EmptyState from "./Empty-State";
import LoadingState from "./Loading-state";
import {
  FieldValues,
  useFieldArray,
  UseFieldArrayAppend,
  UseFieldArrayRemove,
} from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui-component/Form";

interface AttachmentSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  control: any;
  fields: Attachment[];
  append: any;
  remove: UseFieldArrayRemove;
}

export const AttachmentSidebar = ({
  isOpen,
  onClose,
  control,
  fields,
  append,
  remove,
}: AttachmentSidebarProps) => {
  const showErrorToast = useHandleApiError();
  const showSuccessToast = useSuccessToast();
  // const { fields, append, remove } = useFieldArray({
  //   control,
  //   name: "attachments",
  // });

  const [attachments, setAttachments] = useState<Attachment[] | []>([]);
  const [isError, setIsError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const fetchAttachmentData = async () => {
      try {
        setIsLoading(true);
        const attachmentsData = await apiHandler.get<Attachment[]>(
          "/api/files/user/attachments"
        );
        setAttachments(attachmentsData.data!);
        setIsLoading(false);
        showSuccessToast("Attachments loaded...");
      } catch (error) {
        console.log("error while loading attachments", error);
        setIsLoading(false);
        setIsError(true);
        showErrorToast(error as ApiError);
      }
    };
    fetchAttachmentData();
  }, []);

  const handleAttachmentToggle = (attachment: Attachment) => {
    console.log(" attachment toggle", attachment);
    const targetField = fields.find((field) => field?.id === attachment?.id);
    
    console.log("targeted field", targetField);
    console.log("index",fields.findIndex((field) => field.id === attachment.id))
    if (targetField) {
      remove(fields.findIndex((field) => field.id === attachment.id)); 
    } else {
      append(attachment); 
    }
  };
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent showX={true} side="left" className="w-[400px]">
        <SheetHeader>
          <SheetTitle>Select Attachments</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-100px)] mt-6">
          {isError ? (
            <ErrorState message="Failed to load Attachments, Please refresh the page" />
          ) : isLoading ? (
            <LoadingState />
          ) : Array.isArray(attachments) && attachments.length === 0 && !isLoading ? (
            <EmptyState
              icon={<FileText />}
              title="Attachments not found"
              description="Create your first attachment"
            />
          ) : (
            <div className="space-y-4">
              { Array.isArray(attachments) &&    attachments.map((attachment, index) => {
                const isSelected = fields.some((a) => {
                  return a.id === attachment.id;
                });
                return (
                  <>
                    {/* <FormField
                      control={control}
                      key={attachment?.id}
                      name={`attachments.${index}.id`}
                      render={({ field }) => {
                        console.log({ field });
                        return (
                          <FormItem className="w-full">
                            <FormControl>
                              <div
                                key={attachment?.id}
                                className="flex items-center space-x-4 p-2 hover:bg-gray-100 rounded-lg"
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() =>
                                    handleAttachmentToggle(attachment)
                                  }
                                />
                                <File className="h-5 w-5 text-gray-500" />
                                <div className="flex-1">
                                  <p className="font-medium">
                                    {attachment.file_name}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    {attachment.file_size} •{" "}
                                    {new Date(
                                      attachment.uploaded_at
                                    ).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    /> */}
                    <div key={attachment.id} className="flex items-center space-x-4 p-2 hover:bg-gray-100 rounded-lg">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleAttachmentToggle(attachment)}
                      />
                      <File className="h-5 w-5 text-gray-500" />
                      <div className="flex-1">
                        <p className="font-medium">{attachment.file_name}</p>
                        <p className="text-sm text-gray-500">{attachment.file_size}</p>
                      </div>
                    </div>
                  </>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
