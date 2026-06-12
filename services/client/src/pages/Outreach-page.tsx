import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import apiHandler from "../handlers/api-handler";
import { useHandleApiError } from "../handlers/useErrorToast";
import { useSuccessToast } from "../handlers/use-success-toast";
import { useToast } from "../components/ui-component/Use-toast";
import { OutreachSession, OutreachPerson, OutreachRecipient, ReplyEntry } from "../types/outreach";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui-component/Card";
import { Input } from "../components/ui-component/Input";
import { Button } from "../components/ui-component/Button";
import { Badge } from "../components/ui-component/Badge";
import { Textarea } from "../components/ui-component/Text-Area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui-component/Table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui-component/Select";
import DialogModel from "../components/Dialog-model";
import { ArrowLeft, CalendarCheck, MailCheck, Plus, Pencil, Trash2 } from "lucide-react";
import { formatDate } from "../lib/utils";
import LoadingState from "../components/Loading-state";
import ErrorState from "../components/Error-state";

// The route serves two different lists depending on where the user came from:
//   ?mode=interview  → Dashboard: people who scheduled the interview (session-level)
//   ?mode=responded  → History:   recipients who responded (per-recipient)
type Mode = "interview" | "responded";

const getGlobalVar = (session: OutreachSession | null, key: string): string => {
  if (!session) return "";
  return session.global_variables?.find((v) => v.key === key)?.value ?? "";
};

const newId = () =>
  `iv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const OutreachPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const showErrorToast = useHandleApiError();
  const showSuccessToast = useSuccessToast();
  const { toast } = useToast();

  const mode: Mode =
    searchParams.get("mode") === "responded" ? "responded" : "interview";

  const [session, setSession] = useState<OutreachSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Interview / outreach list state ─────────────────────────────────
  const [outreach, setOutreach] = useState<OutreachPerson[]>([]);
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<OutreachPerson | null>(null);
  const [ivName, setIvName] = useState("");
  const [ivNumber, setIvNumber] = useState("");
  const [ivEmail, setIvEmail] = useState("");

  // ── Responded list state ────────────────────────────────────────────
  const [respDialogOpen, setRespDialogOpen] = useState(false);
  // When editing, the manual mail_replied index being edited; "" = adding new.
  const [editingReply, setEditingReply] = useState<{ logId: string; index: number } | null>(null);
  const [selectedLogId, setSelectedLogId] = useState<string>("");
  const [responseMessage, setResponseMessage] = useState("");

  const loadSession = async () => {
    if (!sessionId) return;
    try {
      setLoading(true);
      const res = await apiHandler.get<OutreachSession>(
        `/api/loghistory/session/${sessionId}/outreach`
      );
      if (res.success && res.data) {
        setSession(res.data);

        // Read the outreach people from the namespaced actions.outreach array.
        const list: OutreachPerson[] = Array.isArray(res.data.actions?.outreach)
          ? res.data.actions.outreach
          : [];
        setOutreach(list);
      } else {
        setError(true);
      }
    } catch (err: any) {
      setError(true);
      showErrorToast(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  // Read-only context derived from the session's global variables
  const company = useMemo(
    () =>
      getGlobalVar(session, "company_name") ||
      session?.recipient_companies?.[0] ||
      "",
    [session]
  );
  const jobLink = useMemo(() => getGlobalVar(session, "portal_link"), [session]);
  const jobId = useMemo(() => getGlobalVar(session, "JOB_ID"), [session]);
  const postName = useMemo(() => getGlobalVar(session, "portal_name"), [session]);

  // Recipients who have responded (derived from logs: any mail_replied entry).
  const responders = useMemo(
    () =>
      (session?.recipients ?? []).filter(
        (r) => (r.user_actions?.mail_replied?.length ?? 0) > 0
      ),
    [session]
  );

  // ── Outreach CRUD (persists the whole list) ──────────────────────────
  const persistOutreach = async (list: OutreachPerson[]) => {
    if (!sessionId) return;
    try {
      setSaving(true);
      const res = await apiHandler.put(
        `/api/loghistory/session/${sessionId}/outreach-list`,
        { outreach: list }
      );
      if (res.success) {
        setOutreach(list);
        showSuccessToast("Interview details saved.");
      }
    } catch (err: any) {
      showErrorToast(err);
    } finally {
      setSaving(false);
    }
  };

  const openAddInterviewer = () => {
    setEditingPerson(null);
    setIvName("");
    setIvNumber("");
    setIvEmail("");
    setInterviewDialogOpen(true);
  };

  const openEditInterviewer = (p: OutreachPerson) => {
    setEditingPerson(p);
    setIvName(p.interview_scheduler_name);
    setIvNumber(p.contact_number);
    setIvEmail(p.email);
    setInterviewDialogOpen(true);
  };

  const submitInterviewer = async () => {
    if (!ivName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter the person's name.",
        variant: "destructive",
      });
      return;
    }
    const entry: OutreachPerson = {
      id: editingPerson?.id ?? newId(),
      interview_scheduler_name: ivName.trim(),
      contact_number: ivNumber.trim(),
      email: ivEmail.trim(),
      company,
    };
    const list = editingPerson
      ? outreach.map((i) => (i.id === entry.id ? entry : i))
      : [...outreach, entry];
    await persistOutreach(list);
    setInterviewDialogOpen(false);
  };

  const deleteInterviewer = async (id: string) => {
    await persistOutreach(outreach.filter((i) => i.id !== id));
  };

  // ── Responder CRUD (per-recipient user_actions.mail_replied[]) ────────
  // Persist the full mail_replied array for one recipient's log.
  const persistReplies = async (
    logId: number,
    mailReplied: ReplyEntry[]
  ): Promise<boolean> => {
    const res = await apiHandler.patch(
      `/api/loghistory/log/${logId}/actions`,
      { mail_replied: mailReplied }
    );
    return !!res.success;
  };

  const repliesFor = (logId: string): ReplyEntry[] => {
    const r = session?.recipients.find((x) => String(x.id) === logId);
    return r?.user_actions?.mail_replied ?? [];
  };

  const openAddResponder = () => {
    setEditingReply(null);
    setSelectedLogId("");
    setResponseMessage("");
    setRespDialogOpen(true);
  };

  // Edit a specific manual reply entry on a recipient.
  const openEditResponder = (r: OutreachRecipient, index: number) => {
    setEditingReply({ logId: String(r.id), index });
    setSelectedLogId(String(r.id));
    setResponseMessage(r.user_actions?.mail_replied?.[index]?.response_message ?? "");
    setRespDialogOpen(true);
  };

  const submitResponder = async () => {
    if (!selectedLogId) {
      toast({
        title: "Select a recipient",
        description: "Please select a recipient first.",
        variant: "destructive",
      });
      return;
    }
    try {
      setSaving(true);
      const existing = repliesFor(selectedLogId);
      const entry: ReplyEntry = {
        response_message: responseMessage.trim(),
        responded_at: new Date().toISOString(),
        source: "manual",
      };
      let next: ReplyEntry[];
      if (editingReply) {
        next = existing.map((e, i) =>
          i === editingReply.index
            ? { ...entry, responded_at: e.responded_at }
            : e
        );
      } else {
        next = [...existing, entry];
      }
      const ok = await persistReplies(Number(selectedLogId), next);
      if (ok) {
        showSuccessToast("Response saved.");
        setRespDialogOpen(false);
        await loadSession();
      }
    } catch (err: any) {
      showErrorToast(err);
    } finally {
      setSaving(false);
    }
  };

  // Remove one reply entry (by index) from a recipient's mail_replied list.
  const deleteResponder = async (logId: number, index: number) => {
    try {
      setSaving(true);
      const existing = repliesFor(String(logId));
      const next = existing.filter((_, i) => i !== index);
      const ok = await persistReplies(logId, next);
      if (ok) {
        showSuccessToast("Response removed.");
        await loadSession();
      }
    } catch (err: any) {
      showErrorToast(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error || !session)
    return (
      <ErrorState message="Unable to load session details. Please go back and retry." />
    );

  // Recipients available to add a response for. When adding a NEW reply, any
  // recipient is allowed (a recipient can reply more than once). When editing,
  // lock to the recipient being edited.
  const availableRecipients = editingReply
    ? session.recipients.filter((r) => String(r.id) === editingReply.logId)
    : session.recipients;

  // Flatten responders -> one row per reply entry, for the "Who responded" table.
  const responderRows = responders.flatMap((r) =>
    (r.user_actions?.mail_replied ?? []).map((entry, index) => ({
      recipient: r,
      entry,
      index,
    }))
  );

  return (
    <div className="p-4 space-y-6 max-w-5xl mx-auto">
      <Button
        variant="ghost"
        size="sm"
        onClick={() =>
          navigate(mode === "responded" ? "/dashboard/history" : "/dashboard")
        }
        className="flex items-center gap-1"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      {/* Session context */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {mode === "responded" ? (
              <MailCheck className="h-4 w-4" />
            ) : (
              <CalendarCheck className="h-4 w-4" />
            )}
            Session Details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <Detail label="Subject" value={session.subject} />
          <Detail label="Template" value={session.template_name ?? "-"} />
          <Detail label="Company" value={company || "-"} />
          <Detail label="Job ID" value={jobId || "-"} />
          <Detail label="Job Link" value={jobLink || "-"} isLink />
          <Detail label="Post / Portal" value={postName || "-"} />
          <Detail label="Started" value={formatDate(session.started_at)} />
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Companies</span>
            <div className="flex flex-wrap gap-1">
              {session.recipient_companies.length > 0 ? (
                session.recipient_companies.map((c) => (
                  <Badge key={c} variant="outline" className="text-xs">
                    {c}
                  </Badge>
                ))
              ) : (
                <span>-</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* List + add — dynamic based on mode */}
      {mode === "interview" ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Interview Scheduled — People</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Everyone who reached out / scheduled an interview for this role.
              </p>
            </div>
            <Button size="sm" onClick={openAddInterviewer}>
              <Plus className="h-4 w-4 mr-1" /> Add person
            </Button>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Number</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outreach.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                        No one added yet. Click "Add person" to start.
                      </TableCell>
                    </TableRow>
                  ) : (
                    outreach.map((iv) => (
                      <TableRow key={iv.id}>
                        <TableCell className="font-medium">{iv.interview_scheduler_name || "-"}</TableCell>
                        <TableCell>{iv.contact_number || "-"}</TableCell>
                        <TableCell>{iv.email || "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditInterviewer(iv)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600"
                            disabled={saving}
                            onClick={() => deleteInterviewer(iv.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Who Responded</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Recipients of this campaign who replied.
              </p>
            </div>
            <Button size="sm" onClick={openAddResponder}>
              <Plus className="h-4 w-4 mr-1" /> Add response
            </Button>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {responderRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                        No responses recorded yet. Click "Add response".
                      </TableCell>
                    </TableRow>
                  ) : (
                    responderRows.map(({ recipient, entry, index }) => (
                      <TableRow key={`${recipient.id}-${index}`}>
                        <TableCell className="font-medium">{recipient.recipient_email}</TableCell>
                        <TableCell className="max-w-[280px] truncate">
                          {entry.response_message || "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {entry.responded_at ? formatDate(entry.responded_at) : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={entry.source === "auto" ? "secondary" : "outline"}
                            className="text-xs"
                          >
                            {entry.source === "auto" ? "Auto" : "Manual"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {/* Auto entries are captured by the system and read-only. */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={entry.source === "auto"}
                            onClick={() => openEditResponder(recipient, index)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600"
                            disabled={saving}
                            onClick={() => deleteResponder(recipient.id, index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Interviewer add/edit dialog */}
      <DialogModel
        DialogSizeClass="max-w-md"
        title={editingPerson ? "Edit person" : "Add person"}
        description="Person who reached out / scheduled the interview."
        TriggerElement={""}
        isOpen={interviewDialogOpen}
        onClose={(open) => setInterviewDialogOpen(open)}
      >
        <div className="space-y-4">
          <Field label="Name">
            <Input value={ivName} onChange={(e) => setIvName(e.target.value)} placeholder="e.g. Priya Sharma" />
          </Field>
          <Field label="Contact number">
            <Input value={ivNumber} onChange={(e) => setIvNumber(e.target.value)} placeholder="e.g. +91 98765 43210" />
          </Field>
          <Field label="Contact email">
            <Input type="email" value={ivEmail} onChange={(e) => setIvEmail(e.target.value)} placeholder="e.g. priya@company.com" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setInterviewDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submitInterviewer} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogModel>

      {/* Responder add/edit dialog */}
      <DialogModel
        DialogSizeClass="max-w-md"
        title={editingReply ? "Edit response" : "Add response"}
        description="Recipient who responded and their message."
        TriggerElement={""}
        isOpen={respDialogOpen}
        onClose={(open) => setRespDialogOpen(open)}
      >
        <div className="space-y-4">
          <Field label="Recipient">
            <Select
              value={selectedLogId}
              onValueChange={setSelectedLogId}
              disabled={!!editingReply}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a recipient" />
              </SelectTrigger>
              <SelectContent>
                {availableRecipients.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.recipient_email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Response message">
            <Textarea
              value={responseMessage}
              onChange={(e) => setResponseMessage(e.target.value)}
              placeholder="What did they say?"
              rows={4}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setRespDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submitResponder} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogModel>
    </div>
  );
};

const Detail = ({
  label,
  value,
  isLink,
}: {
  label: string;
  value: string;
  isLink?: boolean;
}) => (
  <div className="flex flex-col gap-1">
    <span className="text-muted-foreground text-xs">{label}</span>
    {isLink && value && value !== "-" ? (
      <a href={value} target="_blank" rel="noreferrer" className="text-primary underline truncate">
        {value}
      </a>
    ) : (
      <span className="truncate">{value}</span>
    )}
  </div>
);

const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <label className="text-sm font-medium">{label}</label>
    {children}
  </div>
);

export default OutreachPage;
