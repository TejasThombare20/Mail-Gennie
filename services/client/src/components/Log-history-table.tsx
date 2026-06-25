import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui-component/Button";
import { Input } from "./ui-component/Input";
import {
  Mails,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  ColumnFiltersState,
  ExpandedState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle } from "./ui-component/Card";
import { ScrollArea } from "./ui-component/Scroll-Area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui-component/Table";
import apiHandler from "../handlers/api-handler";
import { getEmailLogsApiResponse } from "../types/email-logs";
import PaginationComponent from "./Pagination-component";
import ErrorState from "./Error-state";
import LoadingState from "./Loading-state";
import EmptyState from "./Empty-State";
import { getColumns } from "../lib/LogHistoryTableColumn";
import DialogModel from "./Dialog-model";
import HistoryRowDetails from "./History-Row-Details";
import ExpandedHistoryrow from "./Expanded-History-row";

const Historytable = () => {
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [emailHistory, setEmailHistory] = useState<getEmailLogsApiResponse[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isErrror, SetIsError] = useState(false);
  const [selectedEmail, setSelectedEmail] =
    useState<getEmailLogsApiResponse | null>(null);
  // Sessions whose recipient details are currently being lazy-fetched.
  const [detailsLoading, setDetailsLoading] = useState<Record<string, boolean>>(
    {}
  );
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  // Lazy-load a session's full details (recipients + variables) on demand and
  // merge them into the row. The list payload omits these heavy fields, so we
  // only fetch them when a row is expanded or "View details" is opened. Cached:
  // a session that already has email_logs is never refetched.
  const fetchSessionDetails = async (
    sessionId: string
  ): Promise<getEmailLogsApiResponse | null> => {
    const existing = emailHistory.find((s) => s.id === sessionId);
    if (existing?.email_logs) return existing; // already loaded
    try {
      setDetailsLoading((m) => ({ ...m, [sessionId]: true }));
      const res = await apiHandler.get<getEmailLogsApiResponse>(
        `/api/loghistory/session/${sessionId}/details`
      );
      const detailed = res?.data ?? null;
      if (detailed) {
        setEmailHistory((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  email_logs: detailed.email_logs ?? [],
                  global_variables: detailed.global_variables ?? [],
                }
              : s
          )
        );
      }
      return detailed;
    } catch (error) {
      console.error("Error fetching session details:", error);
      return null;
    } finally {
      setDetailsLoading((m) => ({ ...m, [sessionId]: false }));
    }
  };

  // Open the "Email Campaign Details" modal, lazy-loading recipients first.
  const handleViewDetails = async (row: getEmailLogsApiResponse) => {
    if (row.email_logs) {
      setSelectedEmail(row);
      return;
    }
    setSelectedEmail(row); // show modal immediately with a loading state
    const detailed = await fetchSessionDetails(row.id);
    if (detailed) {
      setSelectedEmail({
        ...row,
        email_logs: detailed.email_logs ?? [],
        global_variables: detailed.global_variables ?? [],
      });
    }
  };

  const columns = getColumns({
    setSelectedEmail: (updater) => {
      // Route "View details" through the lazy-loader.
      const value =
        typeof updater === "function" ? updater(selectedEmail) : updater;
      if (value) handleViewDetails(value);
      else setSelectedEmail(null);
    },
    onResponded: (sessionId: string) =>
      navigate(`/dashboard/outreach/${sessionId}?mode=responded`),
  });

  const table = useReactTable({
    data: emailHistory,
    columns,
    state: {
      expanded,
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    onExpandedChange: setExpanded,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    // Stable row id = session id, so `expanded` keys are session ids (not array
    // indices). Makes lazy-fetch-on-expand and detail merges robust to sorting.
    getRowId: (row) => row.id,
    // Recipients are lazy-loaded, so subRows are empty until then; allow
    // expansion based on recipient_count instead.
    getRowCanExpand: (row) => (row.original.recipient_count ?? 0) > 0,
    //@ts-ignore
    getSubRows: (row) => row.email_logs,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
  });

  // When a row becomes expanded, lazy-fetch its recipients (cached). With
  // getRowId set, `expanded` keys are session ids.
  useEffect(() => {
    const wantDetails = (id: string) => {
      const s = emailHistory.find((x) => x.id === id);
      if (s && (s.recipient_count ?? 0) > 0 && !s.email_logs) {
        fetchSessionDetails(id);
      }
    };
    if (expanded === true) {
      // search auto-expands everything; load details for all visible rows.
      emailHistory.forEach((s) => wantDetails(s.id));
    } else if (expanded && typeof expanded === "object") {
      Object.entries(expanded).forEach(([id, open]) => open && wantDetails(id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  // Server-side search: debounce the query and (re)fetch. The server matches
  // recipient email, name (local vars), company name / portal link / post link
  // (global vars), subject and template name across ALL sessions — not just the
  // latest 10 — so older recipients are found too.
  useEffect(() => {
    const t = setTimeout(() => {
      fetchEmailHistory(searchQuery.trim());
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const fetchEmailHistory = async (search = "") => {
    try {
      setIsLoading(true);
      SetIsError(false);
      const url = search
        ? `/api/loghistory/?search=${encodeURIComponent(search)}`
        : "/api/loghistory/";
      const response = await apiHandler.get<getEmailLogsApiResponse[]>(url);
      setEmailHistory(response?.data ?? []);
      // Auto-expand all sessions while searching so a matching recipient (in a
      // sub-row) is visible; collapse again when the search is cleared.
      setExpanded(search ? true : {});
      setIsLoading(false);
    } catch (error) {
      SetIsError(true);
      setIsLoading(false);
      console.error("Error fetching email history:", error);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Email History</h1>
        <div className="flex gap-2 items-center">
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search email, name, company, portal/post link..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchEmailHistory(searchQuery.trim())}
            className="flex items-center gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-lg">Your recents email's</CardTitle>
        </CardHeader>
        <CardContent>
          {isErrror ? (
            <ErrorState message="Something went wrong. Please retry or contact administrator" />
          ) : isLoading ? (
            <LoadingState />
          ) : !isLoading && emailHistory?.length === 0 && !searchQuery ? (
            <EmptyState
              title="Email history is Empty"
              description="You haven't send any mail yet"
              icon={<Mails />}
            />
          ) : (
            <div>
              <ScrollArea className="h-[calc(100vh-280px)] p-2">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => {
                          return (
                            <TableHead key={header.id}>
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}
                            </TableHead>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel()?.rows?.length ? (
                      table.getRowModel()?.rows?.map((row) => (
                        <React.Fragment key={row.id}>
                          <TableRow
                            data-state={row.getIsExpanded() && "expanded"}
                            className={
                              row.getIsExpanded()
                                ? "bg-muted/30 rounded-md "
                                : ""
                            }
                          >
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id}>
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext()
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                          {row.getIsExpanded() && (
                            <>
                              <ExpandedHistoryrow
                                columns={columns}
                                row={row}
                                loading={
                                  !!detailsLoading[row.original.id] &&
                                  !row.original.email_logs
                                }
                              />
                            </>
                          )}
                        </React.Fragment>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={columns.length}
                          className="h-24 text-center"
                        >
                          No results.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
              <div className="flex justify-center mt-4">
                <PaginationComponent table={table} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <DialogModel
        DialogSizeClass="max-w-6xl max-h-[90vh] overflow-hidden"
        title="Email Campaign Details"
        description=""
        TriggerElement={""}
        isOpen={!!selectedEmail}
        onClose={(open) => !open && setSelectedEmail(null)}
      >
        <>
          {selectedEmail && selectedEmail.email_logs ? (
            // Recipients + variables are lazy-loaded; render only once present.
            <HistoryRowDetails selectedRow={selectedEmail} />
          ) : (
            <LoadingState />
          )}
        </>
      </DialogModel>
    </div>
  );
};

export default Historytable;
