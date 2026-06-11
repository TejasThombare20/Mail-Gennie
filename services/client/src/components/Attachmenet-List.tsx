import React from "react";
import { Card, CardContent } from "./ui-component/Card";
import { Button } from "./ui-component/Button";
import { File, X } from "lucide-react";
import { Attachment } from "../types/attachment.type";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "./ui-component/Form";
import { useFieldArray, UseFieldArrayRemove } from "react-hook-form";

interface AttachmentListProps {
  control: any;
  fields: Attachment[];
  remove: UseFieldArrayRemove;
}

export const AttachmentList = ({
  control,
  fields,
  remove,
}: AttachmentListProps) => {
  // const { fields, remove } = useFieldArray({ control, name: "attachments" });
  if (fields.length === 0) return null;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {fields.map((field, index) => (
            <>
              {/* <FormField
                control={control}
                name={`field.id`}
                render={({ field : Field }) => (
                  <FormItem>
                    <FormControl>
                      <div
                        key={field.id}
                        className="relative p-4 border rounded-lg hover:bg-gray-50"
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          className="absolute top-2 right-2"
                          onClick={() => remove(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center space-x-3 mt-4">
                          <File className="h-5 w-5 text-gray-500" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{field.file_name}</p>
                            <p className="text-sm text-gray-500">{field?.file_size}</p>
                          </div>
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              /> */}
              <div
                key={field.id}
                className="relative p-4 border rounded-lg hover:bg-gray-50"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  className="absolute top-2 right-2"
                  onClick={() => remove(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="flex items-center space-x-3 mt-4">
                  <File className="h-5 w-5 text-gray-500" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{field.file_name}</p>
                    <p className="text-sm text-gray-500">{field?.file_size}</p>
                  </div>
                </div>
              </div>
            </>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
