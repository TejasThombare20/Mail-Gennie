import React, { useEffect, useMemo, useState } from "react";
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
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const columns = getColumns({
    setSelectedEmail,
    onResponded: (sessionId: string) =>
      navigate(`/dashboard/outreach/${sessionId}?mode=responded`),
  });

  // Client-side search across subject, template, recipient email/name,
  // and global + local variable keys/values.
  const filteredHistory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return emailHistory;

    const varMatches = (
      vars?: Array<{ key?: string; value?: string }>
    ): boolean =>
      (vars || []).some(
        (v) =>
          v?.key?.toLowerCase().includes(q) ||
          v?.value?.toLowerCase().includes(q)
      );

    return emailHistory.filter((session) => {
      if (session.subject?.toLowerCase().includes(q)) return true;
      if (session.template_name?.toLowerCase().includes(q)) return true;
      if (varMatches(session.global_variables)) return true;

      return (session.email_logs || []).some(
        (log) =>
          log.recipient_email?.toLowerCase().includes(q) ||
          varMatches(log.local_variables)
      );
    });
  }, [emailHistory, searchQuery]);

  const table = useReactTable({
    data: filteredHistory,
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
    // getPaginationRowModel: getPaginationRowModel(),
    // getSortedRowModel: getSortedRowModel(),
    // getFilteredRowModel: getFilteredRowModel(),
    //@ts-ignore
    getSubRows: (row) => row.email_logs,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
  });

  useEffect(() => {
    fetchEmailHistory();
  }, []);

  const fetchEmailHistory = async () => {
    try {
      setIsLoading(true);
      const response = await apiHandler.get<getEmailLogsApiResponse[]>(
        "/api/loghistory/"
      );
      setEmailHistory(response?.data!);
      setIsLoading(false);
    } catch (error) {
      SetIsError(true);
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
              placeholder="Search email, name, subject, variables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchEmailHistory}
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
          ) : !isLoading && emailHistory?.length === 0   ? (
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
                              <ExpandedHistoryrow columns={columns} row={row} />
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
          {selectedEmail ? (
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
