import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import _ from "lodash";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui-component/Card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui-component/Form";
import { EmailTemplate } from "../types/template-types";
import RecipientList from "./Receipt-List";
import TemplateSelector from "./Template-selector";
import { Input } from "./ui-component/Input";
import { Button } from "./ui-component/Button";
import { Info } from "lucide-react";
import VariableManager from "./Variable-List";
import apiHandler, { ApiError } from "../handlers/api-handler";
import { useHandleApiError } from "../handlers/useErrorToast";
import { useSuccessToast } from "../handlers/use-success-toast";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui-component/Dialog";
import { useLocation, useNavigate } from "react-router-dom";
import { useUnsavedChangesWarning } from "../hooks/useUnsavedChangesWarning";

const sendEmailSchema = z.object({
  recipients: z
    .array(z.string().email())
    .nonempty("At least one recipient is required"),
  template: z.custom<EmailTemplate>().refine((val) => val?.id, {
    message: "Template selection is required",
  }),
  subject: z.string().min(1, "Subject is required"),
  global_variables: z.array(
    z.object({
      key: z.string().min(1, "Key is required"),
      id: z.string().uuid().min(1, "Id is required"),
      value: z.string().min(1, "Placeholder's value should not be empty"),
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

const SendEmailForm = () => {
  const showErrorToast = useHandleApiError();
  const showSuccessToast = useSuccessToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  // Use our custom hook for browser navigation warning
  useUnsavedChangesWarning(isFormDirty);

  const form = useForm<z.infer<typeof sendEmailSchema>>({
    resolver: zodResolver(sendEmailSchema),
    defaultValues: {
      recipients: [],
      template: {},
      subject: "",
      global_variables: [],
      local_variables: [],
    },
  });
  const selectedTemplate = form.watch("template");
  
  // Track form dirty state
  useEffect(() => {
    const subscription = form.watch(() => {
      // Check if any field has been modified
      if (form.formState.isDirty && !isFormDirty) {
        setIsFormDirty(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [form.watch, form.formState.isDirty, isFormDirty]);

  // Handle React Router navigation
  useEffect(() => {
    const handleBeforeNavigate = (e: MouseEvent) => {
      // Find if the click is on a navigation link
      const target = e.target as HTMLElement;
      const linkElement = target.closest('a');
      
      if (!linkElement) return;
      
      const href = linkElement.getAttribute('href');
      if (!href || href.startsWith('http') || href === location.pathname) return;
      
      // If form is dirty, prevent navigation and show dialog
      if (isFormDirty) {
        e.preventDefault();
        setPendingNavigation(href);
        setShowConfirmDialog(true);
      }
    };
    
    document.addEventListener('click', handleBeforeNavigate);
    return () => {
      document.removeEventListener('click', handleBeforeNavigate);
    };
  }, [isFormDirty, location.pathname]);

  const handleConfirmNavigation = () => {
    setIsFormDirty(false);
    setShowConfirmDialog(false);
    if (pendingNavigation) {
      navigate(pendingNavigation);
    }
  };

  const handleCancelNavigation = () => {
    setPendingNavigation(null);
    setShowConfirmDialog(false);
  };

  const onSubmit = async (formData: z.infer<typeof sendEmailSchema>) => {
    try {
      formData.template = _.get(formData, "template.id", null) as any;

      if(formData.template){        
        await apiHandler.post(`/api/email/${formData.template}`, formData);
        form.reset();
        setIsFormDirty(false);
        showSuccessToast("email send successfully");
      }

    } catch (error) {
      console.log("error while sending emails", error);
      showErrorToast(error as ApiError);
    }
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Send Batch Emails</CardTitle>
          <CardDescription>
            Send personalized emails to multiple recipients
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="recipients"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipients</FormLabel>
                    <FormControl>
                      <RecipientList
                        onChange={field.onChange}
                        recipients={field.value}
                        control={form.control}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Subject</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter email subject" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="template"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Template</FormLabel>
                    <FormControl>
                      <TemplateSelector
                        form={form}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedTemplate && selectedTemplate.id && (
                <div className="flex flex-row justify-center items-center gap-2">
                  <FormField
                    control={form.control}
                    name="local_variables"
                    render={({ field }) => (
                      <FormItem className="w-2/4 flex-grow">
                        <FormControl>
                          <VariableManager
                            formControl={form.control}
                            title="Local Variables"
                            key="local"
                            onChange={(newValue) => field.onChange(newValue)}
                            variables={selectedTemplate.local_variables}
                            isGlobal={false}
                            isActionPerform={false}
                            isReadOnly={true}
                            tooltipDescription="Magic variables are differnt for each email reciepients.
                            Variables will be auto generated by system, describe them briefly. 
                            you can update their key and description in their corresponding email template."
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
                      <FormItem className="w-2/4 flex-grow">
                        <FormControl>
                          <VariableManager
                            formControl={form.control}
                            title="Global Variables"
                            key="global"
                            onChange={(newValue) => field.onChange(newValue)}
                            variables={selectedTemplate.global_variables}
                            isGlobal={true}
                            isActionPerform={false}
                            isReadOnly={true}
                            isGValueEditable={true}
                            tooltipDescription="Global variables values are same for all email recipients of one batch.
                            You need to set their values before sending email.you can update their key in their corresponding email template."
                            tootipIcon={<Info />}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <Button type="submit" className="mt-6">
                Send Emails
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Navigation Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave this page?</DialogTitle>
            <DialogDescription>
              You have unsaved changes. If you leave, you will lose your form data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleCancelNavigation}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmNavigation}>
              Leave Page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SendEmailForm;
