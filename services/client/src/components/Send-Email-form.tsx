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
import AiLocalVariables, { GeneratedName } from "./Ai-Local-Variables";
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
  // Per-recipient free-text hints fed to the AI first-name agent. Index-aligned
  // with `recipients`. Empty strings are fine.
  recipient_info: z.array(z.string()).optional(),
  // Optional global instruction that steers the AI naming for the whole batch.
  extra_prompt: z.string().optional(),
  // Optional schedule time. Value comes from a <input type="datetime-local">,
  // i.e. a naive "YYYY-MM-DDTHH:mm" that we interpret as IST on submit.
  // Empty string = send immediately.
  scheduleAt: z
    .string()
    .optional()
    .refine(
      (val) => !val || new Date(`${val}:00+05:30`).getTime() > Date.now(),
      { message: "Schedule time (IST) must be in the future" }
    ),
});

/**
 * Convert a naive datetime-local value ("YYYY-MM-DDTHH:mm") that the user
 * intends as Indian Standard Time into an ISO-8601 instant with the +05:30
 * offset, which the API stores as run_at. Returns null for empty input.
 */
function istLocalToIso(value?: string): string | null {
  if (!value) return null;
  // Append seconds + IST offset so the instant is unambiguous regardless of the
  // browser's own timezone, then normalize to ISO (UTC) for the API.
  const d = new Date(`${value}:00+05:30`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

const SendEmailForm = () => {
  const showErrorToast = useHandleApiError();
  const showSuccessToast = useSuccessToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  // While true, the batch request is in flight and the server is running the AI
  // first-name agent — drives the "generating with AI" animation.
  const [isGenerating, setIsGenerating] = useState(false);
  // First names revealed after the most recent send (for the AI card).
  const [generatedNames, setGeneratedNames] = useState<GeneratedName[]>([]);

  // Progress of the most recently queued batch (driven by status polling).
  const [batchProgress, setBatchProgress] = useState<{
    sessionId: string;
    status: string;
    total: number;
    processed: number;
    sent: number;
    failed: number;
  } | null>(null);

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
      recipient_info: [],
      extra_prompt: "",
      scheduleAt: "",
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

  /**
   * Poll the batch status endpoint until the session completes (or fails).
   * The send now happens asynchronously in the queue worker, so the UI tracks
   * progress instead of blocking on the request.
   */
  const pollBatchStatus = async (sessionId: string) => {
    const maxAttempts = 120; // ~4 min at 2s intervals
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const res = await apiHandler.get<{
          id: string;
          status: string;
          total_emails: number;
          sent_count: number;
          failed_count: number;
          processed: number;
          pending: number;
        }>(`/api/email/session/${sessionId}/status`);

        const d = res.data;
        if (!d) break;

        setBatchProgress({
          sessionId,
          status: d.status,
          total: d.total_emails,
          processed: d.processed,
          sent: d.sent_count,
          failed: d.failed_count,
        });

        if (d.status === "completed" || d.status === "failed") {
          if (d.failed_count > 0) {
            showSuccessToast(
              `Batch done: ${d.sent_count} sent, ${d.failed_count} failed`
            );
          } else {
            showSuccessToast(`All ${d.sent_count} emails sent`);
          }
          return;
        }
      } catch (error) {
        console.log("error polling batch status", error);
        return;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  };

  const onSubmit = async (formData: z.infer<typeof sendEmailSchema>) => {
    try {
      const templateId = _.get(formData, "template.id", null) as string | null;
      if (!templateId) return;

      // Build the API payload. Convert the optional IST schedule time into an
      // ISO instant (scheduledAt); the raw `scheduleAt` field is not sent.
      // `recipient_info` is sent as a parallel array of {email, extraInfo} so the
      // server-side agent can attach each hint to the right recipient.
      const { scheduleAt, template: _t, recipient_info, ...rest } = formData;
      const scheduledAt = istLocalToIso(scheduleAt);
      const recipientInfoPayload = (rest.recipients ?? []).map(
        (email, idx) => ({ email, extraInfo: recipient_info?.[idx] ?? "" })
      );
      const payload = {
        ...rest,
        recipient_info: recipientInfoPayload,
        ...(scheduledAt ? { scheduledAt } : {}),
      };

      // The server runs the AI first-name agent during this request — show the
      // generating animation until it returns.
      setIsGenerating(true);
      setGeneratedNames([]);

      const res = await apiHandler.post<{
        sessionId: string;
        queued: number;
        scheduledFor: string | null;
        generatedNames?: GeneratedName[];
      }>(`/api/email/${templateId}`, payload);

      const data = res.data;
      setIsGenerating(false);
      if (data?.generatedNames) setGeneratedNames(data.generatedNames);
      form.reset();
      setIsFormDirty(false);

      if (data?.scheduledFor) {
        const istLabel = new Date(data.scheduledFor).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
        });
        showSuccessToast(
          `${data.queued} email(s) scheduled for ${istLabel} IST`
        );
      } else if (data?.sessionId) {
        showSuccessToast(`${data.queued} email(s) queued — sending…`);
        setBatchProgress({
          sessionId: data.sessionId,
          status: "queued",
          total: data.queued,
          processed: 0,
          sent: 0,
          failed: 0,
        });
        // Track progress in the background (not scheduled batches).
        void pollBatchStatus(data.sessionId);
      }
    } catch (error) {
      setIsGenerating(false);
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
          {batchProgress && (
            <div className="mb-4 rounded-md border p-3 text-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">
                  {batchProgress.status === "completed"
                    ? "Batch complete"
                    : batchProgress.status === "failed"
                    ? "Batch finished with failures"
                    : "Sending batch…"}
                </span>
                <span className="text-muted-foreground">
                  {batchProgress.processed}/{batchProgress.total}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded bg-gray-200">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{
                    width: `${
                      batchProgress.total
                        ? Math.round(
                            (batchProgress.processed / batchProgress.total) * 100
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {batchProgress.sent} sent · {batchProgress.failed} failed
              </div>
            </div>
          )}
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
                        recipientInfo={form.watch("recipient_info") ?? []}
                        onInfoChange={(info) =>
                          form.setValue("recipient_info", info, {
                            shouldDirty: true,
                          })
                        }
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

              <FormField
                control={form.control}
                name="scheduleAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Schedule (optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Leave empty to send now. Time is treated as IST
                      (Asia/Kolkata). The queue worker must be running at the
                      scheduled time.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedTemplate && selectedTemplate.id && (
                <div className="flex flex-row justify-center items-start gap-2">
                  <div className="w-2/4 flex-grow">
                    <AiLocalVariables
                      variables={selectedTemplate.local_variables ?? []}
                      extraPrompt={form.watch("extra_prompt") ?? ""}
                      onExtraPromptChange={(value) =>
                        form.setValue("extra_prompt", value, {
                          shouldDirty: true,
                        })
                      }
                      isGenerating={isGenerating}
                      generatedNames={generatedNames}
                    />
                  </div>
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
                {form.watch("scheduleAt") ? "Schedule Emails" : "Send Emails"}
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
