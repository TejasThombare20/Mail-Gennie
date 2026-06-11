import React, { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  useForm,
  FormProvider,
  useWatch,
  useFieldArray,
} from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
// import EmailEditor, { EditorRef } from "react-email-editor";
import EmailEditor , { EditorRef } from "react-email-editor";
import { Info, Loader2, Paperclip } from "lucide-react";
import _ from "lodash";
import { Card, CardContent, CardHeader, CardTitle } from "./ui-component/Card";
import { Input } from "./ui-component/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui-component/Select";
import { Button } from "./ui-component/Button";
import { AttachmentSidebar } from "./Attachment-sidebar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui-component/Form";
import { AttachmentList } from "./Attachmenet-List";
import apiHandler, { ApiError } from "../handlers/api-handler";
import { useSuccessToast } from "../handlers/use-success-toast";
import { useHandleApiError } from "../handlers/useErrorToast";
import { Attachment } from "../types/attachment.type";
import VariableManager from "./Variable-List";
import {
  getUserTemplatesApiResponse,
  postUserTemplateApiResponse,
} from "../types/api-response-type";
import VariableAutoComplete from "./Variable-AutoComplete";
import EmailEditor1 from "./email-editor";

export const emailTemplateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Template name is required"),
  category: z.string().min(1, "Category is required"),
  attachments: z.array(
    z.object({
      id: z.string(),
      file_name: z.string(),
      file_type: z.string(),
      file_size: z.number(),
      file_url: z.string(),
      uploaded_at: z.string(),
    })
  ),
  html_content: z.string().min(1, "Email template data cannot be empty"),
  json_data: z.any(z.any()).refine((data) => Object.keys(data).length > 0, {
    message: "Email template data cannot be empty",
  }),
  global_variables: z.array(
    z.object({
      key: z.string().min(1, "Key is required"),
      id: z.string().uuid().min(1, "Id is required"),
    })
  ),
  local_variables: z.array(
    z.object({
      key: z.string().min(1, "Key is required"),
      description: z.string().min(1, "Description is required"),
      id: z.string().uuid().min(1, "Id is required"),
    })
  ),
});

type EmailTemplateFormData = z.infer<typeof emailTemplateSchema>;

interface EmailTemplateFormProps {
  template?: getUserTemplatesApiResponse;
}

const EmailTemplateForm = ({ template }: EmailTemplateFormProps) => {
  const { templateId } = useParams();
  const navigate = useNavigate();

  const showErrorToast = useHandleApiError();
  const showSuccessToast = useSuccessToast();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [dropdown, setDropdown] = useState(false);
  const emailEditorRef = useRef<EditorRef | null>(null);
  const lastContentRef = useRef<string>("");

  const form = useForm<EmailTemplateFormData>({
    resolver: zodResolver(emailTemplateSchema),
    defaultValues: {
      id: template?.id,
      name: template?.name! || "",
      category: template?.category! || "",
      attachments: template?.attachmentsdata || [],
      json_data: template?.json_data || {},
      html_content: template?.html_content || "",
      global_variables: template?.global_variables || [],
      local_variables: template?.local_variables || [],
    },
    shouldFocusError: true,
  });

  const isSubmitting = form.formState.isSubmitting;

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "attachments",
    keyName: "_id",
  });

  const {
    insert: appendGvariable,
    remove: removeGvariable,
    fields: GvariablesFields,
  } = useFieldArray({
    control: form.control,
    name: "global_variables",
  });

  const {
    insert: appnedLvariables,
    remove: removeLvariables,
    fields: LvariableFields,
  } = useFieldArray({
    control: form.control,
    name: "local_variables",
  });

  useEffect(() => {
    const subscription = form.watch(() => {
      setIsFormDirty(form.formState.isDirty);
    });
    return () => subscription.unsubscribe();
  }, [form.watch]);

  const onSubmit = async (formdata: any) => {
    try {
      if (!formdata) {
        throw Error("Invalid data");
      }

      if (!formdata.id) {
        formdata.attachments = formdata.attachments.map(
          (attachment: Attachment) => attachment.id
        );
        const { id, ...requestPayload } = formdata;
        console.log("payload", requestPayload);
        const apiResponse = await apiHandler.post<postUserTemplateApiResponse>(
          "/api/templates",
          requestPayload
        );
        const newTemplateId = apiResponse.data?.id;
        showSuccessToast("template created successfully");

        setTimeout(() => {
          if (newTemplateId) {
            navigate(`/dashboard/templates/${newTemplateId}`);
          } else {
            navigate(`/dashboard/templates`);
          }
        }, 1000);

        console.log("api response", apiResponse);
      } else {
        console.log("Hellp");
        if (template && templateId) {
          formdata.attachments = formdata.attachments.map(
            (attachment: Attachment) => attachment.id
          );
          const changedValues = _.omitBy(
            formdata,
            (value, key: keyof getUserTemplatesApiResponse) =>
              _.isEqual(value, template[key])
          );

          console.log("changed values", changedValues);
          const apiResponse = await apiHandler.put(
            `/api/templates/${templateId}`,
            changedValues
          );
          console.log("apiResponse", apiResponse);
          showSuccessToast("template update successfully");
        }
      }
    } catch (error) {
      console.log("error", error);
      showErrorToast(error as ApiError);
    }
  };

  // const handleEditorChange = (data : any) => {
  //   console.log("calling handleEditorChange ...",)
  //   const content = JSON.stringify(data);

  //   const newContent = data.split(""); // Convert string to array
  //   const prevContent = lastContentRef.current.split("");

  //   const addedText = _.difference(newContent, prevContent).join("");

  //     console.log("Added Text:", addedText);
  //   // console.log("content",content)
  //   if (addedText.includes("{{")) {
  //     console.log("Detected {{ in content!");
  //     setDropdown(true);
  //   }
  //   console.log("end of the func")
  //   lastContentRef.current = data;
  // };

  const [showAutoComplete, setShowAutoComplete] = useState<boolean>(false);
  const [autoCompleteOptions, setAutoCompleteOptions] = useState<
    Array<{ id: string; value: string }>
  >([]);
  const [lastHtmlContent, setLastHtmlContent] = useState<string>("");

  // Add these state variables for positioning the autocomplete
  const [autoCompletePosition, setAutoCompletePosition] = useState<{
    top: number;
    left: number;
  }>({
    top: 0,
    left: 0,
  });

  const handleEditorChange = (html: string) => {
    console.log("calling handleEditorChange...");

    // Store the previous content to compare
    const previousContent = lastHtmlContent;
    setLastHtmlContent(html);

    // Create a temporary element to parse the HTML
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    const textContent = tempDiv.textContent || tempDiv.innerText;

    // Check if "{{" exists in the content and is not closed with "}}"
    const openBracesRegex = /{{(?!.*}})/g;
    const matches = textContent.match(openBracesRegex);

    if (matches && matches.length > 0) {
      console.log("matches length", matches.length);
      // Position the autocomplete near the editor
      // Since we can't get exact cursor position, we'll show it in a fixed position relative to the editor
      const editorElement =
        document.querySelector(".unlayer-editor") ||
        document.querySelector(".emailEditor");

      const editorElement1 = emailEditorRef.current?.editor?.frame?.iframe;
      console.log("editorElement", editorElement);
      console.log("editorElement1", editorElement1);
      if (editorElement1) {
        const rect = editorElement1.getBoundingClientRect();
        setAutoCompletePosition({
          top: rect.top + 100, // Arbitrary position, adjust as needed
          left: rect.left + 200, // Arbitrary position, adjust as needed
        });

        // Show autocomplete with placeholder options
        setAutoCompleteOptions([
          { id: "name", value: "user.name" },
          { id: "email", value: "user.email" },
          { id: "company", value: "user.company" },
          // Add more placeholders as needed
        ]);

        setShowAutoComplete(true);
      }
    } else {
      console.log("email editor not found");
      // Hide autocomplete if no open braces are found
      setShowAutoComplete(false);
    }
  };

  const insertPlaceholder = (placeholder: string) => {
    if (emailEditorRef.current?.editor) {
      // We can't insert at cursor position directly, but we can export, modify, and reload the design
      emailEditorRef.current.editor.exportHtml((data) => {
        const html = data.html;
        const design = data.design;

        // Find the last "{{" and replace it with the complete placeholder
        const modifiedHtml = html.replace(/{{(?!.*}})/, `{{${placeholder}}}`);

        // To modify the design, we'd need to update text blocks containing "{{"
        // This is complex without direct API access, so we're using a workaround

        // Option 1: If unlayer provides an insertText or insertHTML method (check docs)
        // emailEditorRef.current?.editor?.insertText(`{{${placeholder}}}`);

        // Option 2: Reload the entire design (less ideal)
        emailEditorRef.current?.editor?.loadDesign(design);

        // Hide autocomplete after selection
        setShowAutoComplete(false);
      });
    }
  };

  const insertMergeTag = (value: string) => {
    if (emailEditorRef.current?.editor) {
      // emailEditorRef.current.editor.focus();
      //@ts-ignore
      emailEditorRef.current.editor.addText(value);

      setDropdown(false);
    }
  };

  const mergeTags = [
    { name: "Recipient Name", value: "{{recipient_name}}" },
    { name: "Company", value: "{{company}}" },
  ];

  return (
    <div className=" w-full mx-auto p-2 space-y-6">
      <FormProvider {...form}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Card>
              <div className="flex justify-between items-center w-full pr-6">
                <CardHeader>
                  <CardTitle>
                    {template ? "Edit Template" : "Create New Template"}
                  </CardTitle>
                </CardHeader>
                <div className=" flex justify-center items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsSidebarOpen(true)}
                  >
                    <Paperclip className="mr-2 h-4 w-4" />
                    Select Attachments
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || (template && !isFormDirty)}
                  >
                    {isSubmitting ? (
                      <div>
                        <Loader2 />
                      </div>
                    ) : template ? (
                      "Update Template"
                    ) : (
                      "Save Template"
                    )}
                  </Button>
                </div>
              </div>
              <CardContent className="space-y-6">
                <div className="w-full flex justify-between items-center gap-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel>Template Name</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel>Category</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="reach_out">Reachout</SelectItem>
                            <SelectItem value="refferal">Refferal</SelectItem>
                            <SelectItem value="other">other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex flex-row justify-between items-center gap-2">
                  <FormField
                    control={form.control}
                    name="local_variables"
                    render={({ field }) => (
                      <FormItem className="w-3/5">
                        <FormControl>
                          <VariableManager
                            formControl={form.control}
                            title="Local Variables"
                            key="local"
                            onChange={(newValue) => field.onChange(newValue)}
                            variables={LvariableFields}
                            isGlobal={false}
                            append={appnedLvariables}
                            remove={removeLvariables}
                            tooltipDescription="Magic variables are differnt for each email reciepients.
                            Magic variables will be generated automatically by system , describe them briefly. Use the varibles key as a placeholder in the email template"
                            tootipIcon={<Info />}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="global_variables"
                    render={({ field }) => (
                      <FormItem className="w-2/5">
                        <FormControl>
                          <VariableManager
                            formControl={form.control}
                            title="Global Variables"
                            key="global"
                            onChange={(newValue) => field.onChange(newValue)}
                            variables={GvariablesFields}
                            isGlobal={true}
                            append={appendGvariable}
                            remove={removeGvariable}
                            tooltipDescription="Global variables values are same for all email recipients of one batch.
                            you can set the key value for variable. Use the varibles key as a placeholder in the email template"
                            tootipIcon={<Info />}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="attachments"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <AttachmentList
                            control={form.control}
                            fields={fields}
                            remove={remove}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="attachments"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <AttachmentSidebar
                          control={form.control}
                          fields={fields}
                          remove={remove}
                          append={append}
                          isOpen={isSidebarOpen}
                          onClose={() => setIsSidebarOpen(false)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className=" w-full border rounded-md overflow-x-auto  relative ">
                  <FormField
                    control={form.control}
                    name="json_data"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormControl>
                          <EmailEditor
                            {...field}
                            ref={emailEditorRef}
                            onLoad={() => {
                              if (
                                emailEditorRef.current &&
                                emailEditorRef.current.editor
                              ) {
                                // Only load design if json_data has actual content (not empty {})
                                if (
                                  field.value &&
                                  Object.keys(field.value).length > 0
                                ) {
                                  emailEditorRef.current.editor.loadDesign(
                                    field.value
                                  );
                                }
                                emailEditorRef.current.editor.setAppearance({
                                  theme: "modern_dark",
                                });
                              }
                            }}
                            onReady={() => {
                              if (emailEditorRef.current?.editor) {
                                emailEditorRef.current.editor.addEventListener(
                                  "design:updated",
                                  () => {
                                    emailEditorRef.current?.editor?.exportHtml(
                                      (data) => {
                                        form.setValue(
                                          "json_data",
                                          data.design,
                                          { shouldValidate: true }
                                        );
                                        console.log("data-HTML", data.html);
                                        form.setValue(
                                          "html_content",
                                          data.html,
                                          { shouldValidate: true }
                                        );
                                        handleEditorChange(data.html);
                                      }
                                    );
                                  }
                                );
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage className="dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  {/* <FormField
                    control={form.control}
                    name="json_data"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormControl>
                          <EmailEditor1 />
                        </FormControl>
                        <FormMessage className="dark:text-red-400" />
                      </FormItem>
                    )}
                  /> */}
                </div>
              </CardContent>
            </Card>
          </form>
        </Form>
      </FormProvider>
      {dropdown && (
        <VariableAutoComplete
          insertMergeTag={insertMergeTag}
          variables={form.getValues("local_variables")}
        />
      )}
      {showAutoComplete && (
        <div
          className="autocomplete-dropdown"
          style={{
            position: "fixed",
            top: `${autoCompletePosition.top}px`,
            left: `${autoCompletePosition.left}px`,
            zIndex: 9999,
            backgroundColor: "white",
            border: "1px solid #ccc",
            borderRadius: "4px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
            padding: "8px 0",
          }}
        >
          {autoCompleteOptions.map((option) => (
            <div
              key={option.id}
              className="autocomplete-item"
              style={{
                padding: "8px 16px",
                cursor: "pointer",
              }}
              onClick={() => insertPlaceholder(option.value)}
            >
              {option.value}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmailTemplateForm;
