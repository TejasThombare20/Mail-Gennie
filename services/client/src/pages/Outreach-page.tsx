import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import apiHandler from "../handlers/api-handler";
import { useHandleApiError } from "../handlers/useErrorToast";
import { useSuccessToast } from "../handlers/use-success-toast";
import { useToast } from "../components/ui-component/Use-toast";
import { OutreachSession, Interviewer, OutreachRecipient } from "../types/outreach";
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

  // ── Interview list state ────────────────────────────────────────────
  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false);
  const [editingInterviewer, setEditingInterviewer] = useState<Interviewer | null>(null);
  const [ivName, setIvName] = useState("");
  const [ivNumber, setIvNumber] = useState("");
  const [ivEmail, setIvEmail] = useState("");

  // ── Responded list state ────────────────────────────────────────────
  const [respDialogOpen, setRespDialogOpen] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string>("");
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

        // Normalise interviewers: prefer the array; fall back to legacy single reachout.
        const details = res.data.outreach_details ?? {};
        let list: Interviewer[] = Array.isArray(details.interviewers)
          ? details.interviewers
          : [];
        if (list.length === 0 && details.reachout?.name) {
          list = [
            {
              id: newId(),
              name: details.reachout.name ?? "",
              number: details.reachout.number ?? "",
              email: details.reachout.email ?? "",
              company: details.reachout.company ?? "",
            },
          ];
        }
        setInterviewers(list);
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

  // Recipients who have responded (derived from logs)
  const responders = useMemo(
    () =>
      (session?.recipients ?? []).filter((r) => r.user_actions?.responded),
    [session]
  );

  // ── Interviewer CRUD (persists the whole list) ───────────────────────
  const persistInterviewers = async (list: Interviewer[]) => {
    if (!sessionId) return;
    try {
      setSaving(true);
      const res = await apiHandler.put(
        `/api/loghistory/session/${sessionId}/interviewers`,
        { interviewers: list }
      );
      if (res.success) {
        setInterviewers(list);
        showSuccessToast("Interview details saved.");
      }
    } catch (err: any) {
      showErrorToast(err);
    } finally {
      setSaving(false);
    }
  };

  const openAddInterviewer = () => {
    setEditingInterviewer(null);
    setIvName("");
    setIvNumber("");
    setIvEmail("");
    setInterviewDialogOpen(true);
  };

  const openEditInterviewer = (iv: Interviewer) => {
    setEditingInterviewer(iv);
    setIvName(iv.name);
    setIvNumber(iv.number);
    setIvEmail(iv.email);
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
    const entry: Interviewer = {
      id: editingInterviewer?.id ?? newId(),
      name: ivName.trim(),
      number: ivNumber.trim(),
      email: ivEmail.trim(),
      company,
    };
    const list = editingInterviewer
      ? interviewers.map((i) => (i.id === entry.id ? entry : i))
      : [...interviewers, entry];
    await persistInterviewers(list);
    setInterviewDialogOpen(false);
  };

  const deleteInterviewer = async (id: string) => {
    await persistInterviewers(interviewers.filter((i) => i.id !== id));
  };

  // ── Responder CRUD (per-recipient log user_actions) ──────────────────
  const openAddResponder = () => {
    setEditingLogId("");
    setSelectedLogId("");
    setResponseMessage("");
    setRespDialogOpen(true);
  };

  const openEditResponder = (r: OutreachRecipient) => {
    setEditingLogId(String(r.id));
    setSelectedLogId(String(r.id));
    setResponseMessage(r.user_actions?.response_message ?? "");
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
      const res = await apiHandler.patch(
        `/api/loghistory/log/${selectedLogId}/actions`,
        { actions: { responded: true, response_message: responseMessage.trim() } }
      );
      if (res.success) {
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

  const deleteResponder = async (logId: number) => {
    try {
      setSaving(true);
      const res = await apiHandler.patch(
        `/api/loghistory/log/${logId}/actions`,
        { actions: { responded: false, response_message: "" } }
      );
      if (res.success) {
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

  // Recipients available to add as responders (not already responded)
  const availableRecipients = session.recipients.filter(
    (r) => String(r.id) === editingLogId || !r.user_actions?.responded
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
                  {interviewers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                        No one added yet. Click "Add person" to start.
                      </TableCell>
                    </TableRow>
                  ) : (
                    interviewers.map((iv) => (
                      <TableRow key={iv.id}>
                        <TableCell className="font-medium">{iv.name || "-"}</TableCell>
                        <TableCell>{iv.number || "-"}</TableCell>
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
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {responders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-20 text-center text-muted-foreground">
                        No responses recorded yet. Click "Add response".
                      </TableCell>
                    </TableRow>
                  ) : (
                    responders.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.recipient_email}</TableCell>
                        <TableCell className="max-w-[320px] truncate">
                          {r.user_actions?.response_message || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditResponder(r)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600"
                            disabled={saving}
                            onClick={() => deleteResponder(r.id)}
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
        title={editingInterviewer ? "Edit person" : "Add person"}
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
        title={editingLogId ? "Edit response" : "Add response"}
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
              disabled={!!editingLogId}
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
