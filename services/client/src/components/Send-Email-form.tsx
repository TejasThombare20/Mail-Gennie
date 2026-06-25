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
import { getUserTemplatesApiResponse } from "../types/api-response-type";
import { parseTemplateNumber } from "../lib/recipient-paste-parser";
import RecipientList from "./Receipt-List";
import TemplateSelector from "./Template-selector";
import { Input } from "./ui-component/Input";
import { Button } from "./ui-component/Button";
import AiLocalVariables, { GeneratedName } from "./Ai-Local-Variables";
import TemplateBatchConfigCard, {
  TemplateBatchConfig,
} from "./Template-batch-config";
import apiHandler, { ApiError } from "../handlers/api-handler";
import { useHandleApiError } from "../handlers/useErrorToast";
import { useSuccessToast } from "../handlers/use-success-toast";
import { useToast } from "./ui-component/Use-toast";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui-component/Dialog";
import { useLocation, useNavigate } from "react-router-dom";
import { useUnsavedChangesWarning } from "../hooks/useUnsavedChangesWarning";

const sendEmailSchema = z.object({
  recipients: z
    .array(z.string().email("One or more recipients are not valid emails"))
    .nonempty("At least one recipient is required"),
  template: z.custom<EmailTemplate>().refine((val) => val?.id, {
    message: "Template selection is required",
  }),
  // Subject + global/local variables are NOT in the form schema anymore: with
  // tag-based routing a batch can span multiple templates, so they're managed
  // per-template in `templateConfigs` state (see below) instead of single fields.
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
  const { toast } = useToast();
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

  // All of the user's templates (loaded by the TemplateSelector). Used to map a
  // recipient tag's "template N" to the actual template whose template_number=N.
  const [allTemplates, setAllTemplates] = useState<
    getUserTemplatesApiResponse[]
  >([]);

  // Aggregate progress of the most recently queued send. A send may span MULTIPLE
  // sessions when recipients are routed to different templates (one session per
  // template group); the counts below are summed across all of them.
  const [batchProgress, setBatchProgress] = useState<{
    sessions: string[];
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
      recipient_info: [],
      extra_prompt: "",
      scheduleAt: "",
    },
  });
  const selectedTemplate = form.watch("template");
  const recipientInfoWatch = form.watch("recipient_info") ?? [];

  // ── Per-template batch config ───────────────────────────────────────────────
  // Subject + variable values, keyed by templateId, for every template actually
  // used in this batch (the selected one + any reached via a "template N" tag).
  const [templateConfigs, setTemplateConfigs] = useState<
    Record<string, TemplateBatchConfig>
  >({});

  /** Map a recipient's tag string to the template id it routes to (or null). */
  const templateIdForTag = (tag: string): string | null => {
    const n = parseTemplateNumber(tag);
    if (n === null) return null;
    return allTemplates.find((t) => t.template_number === n)?.id ?? null;
  };

  /** The distinct templates this batch will send with (preserve selected first). */
  const templatesInUse = useMemo(() => {
    const ids: string[] = [];
    const add = (id?: string | null) => {
      if (id && !ids.includes(id)) ids.push(id);
    };
    add(selectedTemplate?.id);
    for (const tag of recipientInfoWatch) add(templateIdForTag(tag ?? ""));
    return ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplate?.id, JSON.stringify(recipientInfoWatch), allTemplates]);

  /** How many recipients route to a given template id. */
  const recipientCountFor = (templateId: string): number => {
    let count = 0;
    recipientInfoWatch.forEach((tag) => {
      const routed = templateIdForTag(tag ?? "") ?? selectedTemplate?.id;
      if (routed === templateId) count++;
    });
    return count;
  };

  // Ensure each template in use has a config; initialize from its definition and
  // seed shared global values from configs already filled (so e.g. company_name
  // entered for one template carries to another that also declares it).
  useEffect(() => {
    setTemplateConfigs((prev) => {
      let changed = false;
      const next = { ...prev };

      const sharedValueForKey = (key: string): string | undefined => {
        for (const cfg of Object.values(next)) {
          const g = cfg.globals.find((gv) => gv.key === key && gv.value);
          if (g?.value) return g.value;
        }
        return undefined;
      };

      for (const id of templatesInUse) {
        if (next[id]) continue;
        const tpl = allTemplates.find((t) => t.id === id);
        if (!tpl) continue;
        next[id] = {
          templateId: id,
          name: tpl.name,
          templateNumber: tpl.template_number ?? null,
          subject: tpl.subject ?? "",
          globals: (tpl.global_variables ?? []).map((g) => ({
            key: g.key,
            id: g.id,
            description: g.description,
            value: sharedValueForKey(g.key) ?? g.value ?? "",
          })),
          locals: (tpl.local_variables ?? []).map((l) => ({
            key: l.key,
            id: l.id,
            description: l.description,
          })),
        };
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [templatesInUse, allTemplates]);

  const handleSubjectChange = (templateId: string, subject: string) => {
    setTemplateConfigs((prev) => ({
      ...prev,
      [templateId]: { ...prev[templateId], subject },
    }));
    setIsFormDirty(true);
  };

  /** Update a global value and keep the SAME key in sync across all templates. */
  const handleGlobalValueChange = (
    _templateId: string,
    key: string,
    value: string
  ) => {
    setTemplateConfigs((prev) => {
      const next: Record<string, TemplateBatchConfig> = {};
      for (const [id, cfg] of Object.entries(prev)) {
        next[id] = {
          ...cfg,
          globals: cfg.globals.map((g) =>
            g.key === key ? { ...g, value } : g
          ),
        };
      }
      return next;
    });
    setIsFormDirty(true);
  };

  // Union of local-variable keys across all templates in use — shown in the
  // batch-wide AI naming card (these are all auto-filled per recipient).
  const aiLocalVariablePreview = useMemo(() => {
    const byKey = new Map<
      string,
      { key: string; id: string; description: string }
    >();
    for (const id of templatesInUse) {
      for (const l of templateConfigs[id]?.locals ?? []) {
        if (!byKey.has(l.key)) {
          byKey.set(l.key, {
            key: l.key,
            id: l.id ?? l.key,
            description: l.description ?? "",
          });
        }
      }
    }
    return [...byKey.values()];
  }, [templatesInUse, templateConfigs]);

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
   * Poll a SET of session status endpoints until they all finish, summing the
   * counts into a single aggregate progress view. A send may queue more than one
   * session (one per template group).
   */
  const pollBatchStatus = async (sessionIds: string[], grandTotal: number) => {
    const maxAttempts = 120; // ~4 min at 2s intervals
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const results = await Promise.all(
          sessionIds.map((id) =>
            apiHandler
              .get<{
                status: string;
                total_emails: number;
                sent_count: number;
                failed_count: number;
                processed: number;
              }>(`/api/email/session/${id}/status`)
              .then((r) => r.data)
              .catch(() => null)
          )
        );

        const agg = results.reduce(
          (acc, d) => {
            if (!d) return acc;
            acc.processed += d.processed ?? 0;
            acc.sent += d.sent_count ?? 0;
            acc.failed += d.failed_count ?? 0;
            if (d.status !== "completed" && d.status !== "failed")
              acc.allDone = false;
            return acc;
          },
          { processed: 0, sent: 0, failed: 0, allDone: true }
        );

        setBatchProgress({
          sessions: sessionIds,
          status: agg.allDone ? "completed" : "sending",
          total: grandTotal,
          processed: agg.processed,
          sent: agg.sent,
          failed: agg.failed,
        });

        if (agg.allDone) {
          if (agg.failed > 0) {
            showSuccessToast(
              `Done: ${agg.sent} sent, ${agg.failed} failed`
            );
          } else {
            showSuccessToast(`All ${agg.sent} emails sent`);
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

  /**
   * Group recipients by the template they should be sent with. A recipient whose
   * tag mentions "template N" routes to the user's template with template_number
   * = N; everyone else uses the selected template. Returns the groups plus any
   * recipients that referenced a template number that doesn't exist.
   */
  const groupRecipientsByTemplate = (
    recipients: string[],
    recipientInfo: string[],
    selectedTemplateId: string
  ) => {
    const groups = new Map<
      string,
      { recipients: string[]; recipientInfo: string[] }
    >();
    const unknownTemplateNumbers = new Set<number>();

    recipients.forEach((email, idx) => {
      const tag = recipientInfo[idx] ?? "";
      const n = parseTemplateNumber(tag);

      let templateId = selectedTemplateId;
      if (n !== null) {
        const match = allTemplates.find((t) => t.template_number === n);
        if (match?.id) {
          templateId = match.id;
        } else {
          unknownTemplateNumbers.add(n);
        }
      }

      const g = groups.get(templateId) ?? { recipients: [], recipientInfo: [] };
      g.recipients.push(email);
      g.recipientInfo.push(tag);
      groups.set(templateId, g);
    });

    return { groups, unknownTemplateNumbers };
  };

  const onSubmit = async (formData: z.infer<typeof sendEmailSchema>) => {
    try {
      const selectedTemplateId = _.get(
        formData,
        "template.id",
        null
      ) as string | null;
      if (!selectedTemplateId) return;

      const { scheduleAt, template: _t, recipient_info, ...rest } = formData;
      const recipients = rest.recipients ?? [];
      const recipientInfo = recipient_info ?? [];
      const scheduledAt = istLocalToIso(scheduleAt);

      // Route each recipient to its template (tag "template N" overrides the
      // selected one). Abort if any tag references a template number we don't
      // have — the recipient row already flags this inline.
      const { groups, unknownTemplateNumbers } = groupRecipientsByTemplate(
        recipients,
        recipientInfo,
        selectedTemplateId
      );

      if (unknownTemplateNumbers.size > 0) {
        toast({
          title: "Unknown template number",
          description: `No template found for: ${[...unknownTemplateNumbers]
            .map((n) => `template ${n}`)
            .join(", ")}. Set its "Template #" or fix the tag.`,
          variant: "destructive",
        });
        return;
      }

      // The server runs the AI first-name agent during these requests — show the
      // generating animation until they return.
      setIsGenerating(true);
      setGeneratedNames([]);

      // Fire one batch request per template group (sequentially so the AI-name
      // animation/results stay coherent). Collect sessions + names.
      const sessionIds: string[] = [];
      let totalQueued = 0;
      let scheduledForLabel: string | null = null;
      const collectedNames: GeneratedName[] = [];

      for (const [templateId, group] of groups) {
        // Each template carries its OWN subject + variable values from its
        // per-template config card (shared global keys were kept in sync).
        const cfg = templateConfigs[templateId];

        const payload = {
          ...rest,
          subject: cfg?.subject ?? "",
          global_variables: cfg?.globals ?? [],
          local_variables: cfg?.locals ?? [],
          recipients: group.recipients,
          recipient_info: group.recipients.map((email, idx) => ({
            email,
            extraInfo: group.recipientInfo[idx] ?? "",
          })),
          ...(scheduledAt ? { scheduledAt } : {}),
        };

        const res = await apiHandler.post<{
          sessionId: string;
          queued: number;
          scheduledFor: string | null;
          generatedNames?: GeneratedName[];
        }>(`/api/email/${templateId}`, payload);

        const data = res.data;
        if (data?.generatedNames) collectedNames.push(...data.generatedNames);
        if (data?.queued) totalQueued += data.queued;
        if (data?.scheduledFor) scheduledForLabel = data.scheduledFor;
        if (data?.sessionId) sessionIds.push(data.sessionId);
      }

      setIsGenerating(false);
      if (collectedNames.length) setGeneratedNames(collectedNames);
      form.reset();
      setTemplateConfigs({});
      setIsFormDirty(false);

      if (scheduledForLabel) {
        const istLabel = new Date(scheduledForLabel).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
        });
        showSuccessToast(
          `${totalQueued} email(s) scheduled for ${istLabel} IST`
        );
      } else if (sessionIds.length) {
        showSuccessToast(`${totalQueued} email(s) queued — sending…`);
        setBatchProgress({
          sessions: sessionIds,
          status: "queued",
          total: totalQueued,
          processed: 0,
          sent: 0,
          failed: 0,
        });
        // Track progress in the background (not scheduled batches).
        void pollBatchStatus(sessionIds, totalQueued);
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
                        availableTemplateNumbers={allTemplates
                          .map((t) => t.template_number)
                          .filter(
                            (n): n is number => typeof n === "number"
                          )}
                      />
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
                        onTemplatesLoaded={setAllTemplates}
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

              {/* Per-template configuration. One card per template actually used
                  in this batch (selected + any reached via a "template N" tag),
                  each with its own subject + variable values. */}
              {templatesInUse.length > 0 && (
                <div className="space-y-3">
                  {templatesInUse.length > 1 && (
                    <p className="text-sm text-muted-foreground">
                      This batch uses {templatesInUse.length} templates (routed by
                      recipient tags). Set each template's subject and variables
                      below — shared keys like {"{{company_name}}"} stay in sync.
                    </p>
                  )}
                  {templatesInUse.map((id) =>
                    templateConfigs[id] ? (
                      <TemplateBatchConfigCard
                        key={id}
                        config={templateConfigs[id]}
                        isSelected={id === selectedTemplate?.id}
                        recipientCount={recipientCountFor(id)}
                        onSubjectChange={(subject) =>
                          handleSubjectChange(id, subject)
                        }
                        onGlobalValueChange={(key, value) =>
                          handleGlobalValueChange(id, key, value)
                        }
                      />
                    ) : null
                  )}

                  {/* Batch-wide AI naming: one extra instruction + the names the
                      agent generated on the most recent send. */}
                  <AiLocalVariables
                    variables={aiLocalVariablePreview}
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
