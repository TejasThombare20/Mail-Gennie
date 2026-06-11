import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiHandler from "../handlers/api-handler";
import { useHandleApiError } from "../handlers/useErrorToast";
import DialogModel from "./Dialog-model";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "./ui-component/DropDown";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "./ui-component/Card";
import { Badge } from "./ui-component/Badge";
import { Input } from "./ui-component/Input";
import { Button } from "./ui-component/Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui-component/Select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui-component/Table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "./ui-component/Pagination";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Mail,
  Send,
  AlertTriangle,
  Activity,
  CheckCircle,
  Search,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  CheckSquare,
  Square,
  Eye,
} from "lucide-react";
import { formatDate } from "../lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface DashboardSummary {
  total_sessions: number;
  total_emails_sent: number;
  total_emails_failed: number;
  completed_sessions: number;
  failed_sessions: number;
  in_progress_sessions: number;
}

interface DashboardStats {
  summary: DashboardSummary;
  // sessions also returned here but the table now uses its own paginated endpoint
}

interface SessionRow {
  id: string;
  template_name: string | null;
  status: string;
  total_emails: number;
  sent_count: number;
  failed_count: number;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  duration_seconds: number | null;
  recipient_companies: string[];
  outreach_details: Record<string, any>;
}

interface PaginatedSessions {
  sessions: SessionRow[];
  total: number;
  page: number;
  pageSize: number;
  filters: { statuses: string[]; companies: string[] };
}

interface CompanyDatePoint {
  day: string; // YYYY-MM-DD
  company: string;
  sent: number;
  failed: number;
}

const PIE_COLORS = ["#22c55e", "#ef4444", "#3b82f6", "#eab308"];

// Bar-graph zoom levels: how many bars are visible in the window at once.
// Zooming OUT shows more companies; zooming IN shows fewer.
const ZOOM_LEVELS = [8, 12, 18, 26, 40];
const DEFAULT_ZOOM_INDEX = 1; // start at 12 bars by default

const ALL_VALUE = "__all__";
const PAGE_SIZE = 10;

const Dashboard = () => {
  const showErrorToast = useHandleApiError();
  const navigate = useNavigate();

  // Session whose interview/outreach details are being viewed in a dialog
  const [detailsSession, setDetailsSession] = useState<SessionRow | null>(null);

  // Summary + pie data
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Bar-graph data (company + date aggregated, merged across sessions)
  const [chartData, setChartData] = useState<CompanyDatePoint[]>([]);
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
  // window start index into the (oldest→newest) bar array; null = pinned to most recent
  const [windowStart, setWindowStart] = useState<number | null>(null);

  // Paginated sessions table
  const [sessionsData, setSessionsData] = useState<PaginatedSessions | null>(
    null
  );
  const [tableLoading, setTableLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL_VALUE);
  const [companyFilter, setCompanyFilter] = useState<string>(ALL_VALUE);

  // ── Fetch summary + chart once ─────────────────────────────────────────
  useEffect(() => {
    const fetchTop = async () => {
      try {
        setStatsLoading(true);
        const [statsRes, chartRes] = await Promise.all([
          apiHandler.get<DashboardStats>("/api/loghistory/dashboard/stats"),
          apiHandler.get<CompanyDatePoint[]>(
            "/api/loghistory/dashboard/emails-by-company-date"
          ),
        ]);
        if (statsRes.success && statsRes.data) setStats(statsRes.data);
        if (chartRes.success && chartRes.data) setChartData(chartRes.data);
      } catch (error: any) {
        showErrorToast(error);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchTop();
  }, []);

  // ── Debounce search input ──────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  // ── Fetch paginated sessions when query inputs change ──────────────────
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setTableLoading(true);
        const res = await apiHandler.get<PaginatedSessions>(
          "/api/loghistory/dashboard/sessions",
          {
            params: {
              page,
              pageSize: PAGE_SIZE,
              ...(debouncedSearch ? { search: debouncedSearch } : {}),
              ...(statusFilter !== ALL_VALUE ? { status: statusFilter } : {}),
              ...(companyFilter !== ALL_VALUE ? { company: companyFilter } : {}),
            },
          }
        );
        if (res.success && res.data) setSessionsData(res.data);
      } catch (error: any) {
        showErrorToast(error);
      } finally {
        setTableLoading(false);
      }
    };
    fetchSessions();
  }, [page, debouncedSearch, statusFilter, companyFilter]);

  // ── Bar-graph windowing ────────────────────────────────────────────────
  // Build a merged, chronologically-ordered series. Same company on the same
  // date is already collapsed server-side into one row, so each entry is one bar.
  const barSeries = useMemo(
    () =>
      chartData.map((d) => ({
        // label keeps company + short date so same company on different days is distinct
        name: `${d.company} · ${d.day.slice(5)}`,
        company: d.company,
        day: d.day,
        sent: d.sent,
        failed: d.failed,
      })),
    [chartData]
  );

  const visibleCount = ZOOM_LEVELS[zoomIndex];
  const maxStart = Math.max(0, barSeries.length - visibleCount);
  // null windowStart means "show most recent" (pinned to the right edge)
  const effectiveStart = windowStart === null ? maxStart : Math.min(windowStart, maxStart);
  const visibleBars = barSeries.slice(effectiveStart, effectiveStart + visibleCount);

  const canScrollLeft = effectiveStart > 0;
  const canScrollRight = effectiveStart < maxStart;

  const scrollLeft = () =>
    setWindowStart(Math.max(0, effectiveStart - Math.ceil(visibleCount / 2)));
  const scrollRight = () => {
    const next = Math.min(maxStart, effectiveStart + Math.ceil(visibleCount / 2));
    setWindowStart(next >= maxStart ? null : next);
  };
  const zoomIn = () =>
    setZoomIndex((i) => Math.max(0, i - 1)); // fewer bars
  const zoomOut = () =>
    setZoomIndex((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1)); // more bars

  // ── Loading / empty for the top section ────────────────────────────────
  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Loading dashboard...
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        Unable to load dashboard data.
      </div>
    );
  }

  const { summary } = stats;

  const statusPieData = [
    { name: "Completed", value: summary.completed_sessions },
    { name: "Failed", value: summary.failed_sessions },
    { name: "In Progress", value: summary.in_progress_sessions },
    {
      name: "Pending",
      value:
        summary.total_sessions -
        summary.completed_sessions -
        summary.failed_sessions -
        summary.in_progress_sessions,
    },
  ].filter((d) => d.value > 0);

  const formatDuration = (seconds: number | null) => {
    if (seconds === null) return "-";
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-600 text-white border-0">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-600 text-white border-0">In Progress</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const sessions = sessionsData?.sessions ?? [];
  const total = sessionsData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const availableStatuses = sessionsData?.filters.statuses ?? [];
  const availableCompanies = sessionsData?.filters.companies ?? [];

  return (
    <div className="space-y-6 p-4">
      <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Sessions
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary.total_sessions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Emails Sent
            </CardTitle>
            <Send className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {summary.total_emails_sent}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Emails Failed
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {summary.total_emails_failed}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Success Rate
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {summary.total_emails_sent + summary.total_emails_failed > 0
                ? (
                    (summary.total_emails_sent /
                      (summary.total_emails_sent + summary.total_emails_failed)) *
                    100
                  ).toFixed(1)
                : 0}
              %
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar Chart - Emails per Company / Date */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Emails per Company</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Same company on the same date is merged into one bar.
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={scrollLeft}
                disabled={!canScrollLeft}
                title="Older companies"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={scrollRight}
                disabled={!canScrollRight}
                title="Newer companies"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={zoomIn}
                disabled={zoomIndex === 0}
                title="Zoom in (fewer companies)"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={zoomOut}
                disabled={zoomIndex === ZOOM_LEVELS.length - 1}
                title="Zoom out (more companies)"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {visibleBars.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No session data yet
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={visibleBars}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      angle={-30}
                      textAnchor="end"
                      height={70}
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: "transparent" }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="sent"
                      name="Sent"
                      stackId="emails"
                      fill="#22c55e"
                    />
                    <Bar
                      dataKey="failed"
                      name="Failed"
                      stackId="emails"
                      fill="#ef4444"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Showing {effectiveStart + 1}–
                  {effectiveStart + visibleBars.length} of {barSeries.length}{" "}
                  company/date groups. Use ← → to scroll, zoom out for more.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Pie Chart - Session Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session Status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusPieData.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No session data yet
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {statusPieData.map((_entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Note: This chart shows fully completed vs fully failed sessions, not individual email success/failure counts.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sessions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Session Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search + filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by company, template..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
                {availableStatuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={companyFilter}
              onValueChange={(v) => {
                setCompanyFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All companies</SelectItem>
                {availableCompanies.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Sent</TableHead>
                  <TableHead className="text-center">Failed</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead>Companies</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : sessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      No sessions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="text-muted-foreground">
                        {session.template_name || "-"}
                      </TableCell>
                      <TableCell>{getStatusBadge(session.status)}</TableCell>
                      <TableCell className="text-center text-green-600 font-medium">
                        {session.sent_count}
                      </TableCell>
                      <TableCell className="text-center text-red-600 font-medium">
                        {session.failed_count}
                      </TableCell>
                      <TableCell className="text-center">
                        {session.total_emails}
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        {session.recipient_companies.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {session.recipient_companies.slice(0, 3).map((c) => (
                              <Badge
                                key={c}
                                variant="outline"
                                className="text-xs"
                              >
                                {c}
                              </Badge>
                            ))}
                            {session.recipient_companies.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{session.recipient_companies.length - 3}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {formatDate(session.started_at)}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {formatDuration(session.duration_seconds)}
                      </TableCell>
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                navigate(
                                  `/dashboard/outreach/${session.id}?mode=interview`
                                )
                              }
                            >
                              {session.outreach_details?.interview_scheduled ? (
                                <CheckSquare className="h-4 w-4 text-green-600" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                              {session.outreach_details?.interview_scheduled
                                ? "Interview scheduled ✓ (edit)"
                                : "Interview scheduled?"}
                            </DropdownMenuItem>
                            {session.outreach_details?.interview_scheduled && (
                              <DropdownMenuItem
                                onClick={() => setDetailsSession(session)}
                              >
                                <Eye className="h-4 w-4" />
                                View details
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              {total} session{total === 1 ? "" : "s"} · Page {page} of{" "}
              {totalPages}
            </div>
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || tableLoading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                </PaginationItem>
                <PaginationItem>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-2"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || tableLoading}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>

      {/* Interview / outreach details dialog */}
      <DialogModel
        DialogSizeClass="max-w-lg"
        title="Interview & Outreach Details"
        description="Recorded details for this session."
        TriggerElement={""}
        isOpen={!!detailsSession}
        onClose={(open) => !open && setDetailsSession(null)}
      >
        {detailsSession ? (
          (() => {
            const od = detailsSession.outreach_details ?? {};
            const people: any[] =
              Array.isArray(od.interviewers) && od.interviewers.length > 0
                ? od.interviewers
                : od.reachout?.name
                ? [od.reachout]
                : [];
            return (
              <div className="space-y-3 text-sm">
                <DetailRow
                  label="Interview scheduled"
                  value={od.interview_scheduled ? "Yes" : "No"}
                />
                {people.length === 0 ? (
                  <p className="text-muted-foreground">No people recorded.</p>
                ) : (
                  people.map((p, i) => (
                    <div key={i} className="rounded-md border p-3 space-y-1">
                      <DetailRow label="Name" value={p.name || "-"} />
                      <DetailRow label="Contact number" value={p.number || "-"} />
                      <DetailRow label="Contact email" value={p.email || "-"} />
                    </div>
                  ))
                )}
              </div>
            );
          })()
        ) : null}
      </DialogModel>
    </div>
  );
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-4 border-b pb-2">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-right break-all">{value}</span>
  </div>
);

export default Dashboard;
