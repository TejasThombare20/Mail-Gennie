import { ColumnDef } from "@tanstack/react-table";
import { getEmailLogsApiResponse } from "../types/email-logs";
import { Badge } from "../components/ui-component/Badge";
import { Button } from "../components/ui-component/Button";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  EyeIcon,
  CheckSquare,
  Square,
  MoreVertical
} from "lucide-react";
import { Dispatch, SetStateAction } from "react";
import CircularProgress from "../components/ui-component/CircularProgress";
import { resolveTemplateText } from "./utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "../components/ui-component/DropDown";

interface getColumnsParameters {
  setSelectedEmail: Dispatch<SetStateAction<getEmailLogsApiResponse | null>>;
  onResponded: (sessionId: string) => void;
}

export const getColumns = ({
  setSelectedEmail,
  onResponded,
}: getColumnsParameters): ColumnDef<getEmailLogsApiResponse, any>[] => {
  return [
    {
      id: "expand",
      header: "",
      cell: ({ row }) => {
        return row.getCanExpand() ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={row.getToggleExpandedHandler()}
            className="h-8 w-8 p-0"
          >
            {row.getIsExpanded() ? <ChevronDown /> : <ChevronRight />}
          </Button>
        ) : null;
      },
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "template_name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Template
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="lowercase">{row.getValue("template_name")}</div>
      ),
    },
    {
      accessorKey: "subject",
      header: "Subject",
      cell: ({ row }) => {
        const raw = row.getValue<string>("subject") || "";
        // Resolve {{placeholders}} using the session's global variables (and the
        // first recipient's local vars as a fallback for {{receiver_name}}).
        const resolved = resolveTemplateText(
          raw,
          row.original.global_variables,
          row.original.email_logs?.[0]?.local_variables
        );
        return <div className="capitalize">{resolved}</div>;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status: string = row.getValue("status");
        return (
          <Badge
            variant={
              status === "sent"
                ? "default"
                : status === "failed"
                ? "destructive"
                : "secondary"
            }
          >
            {status}
          </Badge>
        );
      },
    },
    {
      id: "success_rate",
      header: "Success Rate",
      cell: ({ row }) => {
        const total = row.original.total_emails || 0;
        const sent = row.original.sent_count || 0;
        const rate = total > 0 ? Math.round((sent / total) * 100) : 0;
        return (
          <div className="flex items-center">
            <CircularProgress
              value={rate}
              size={42}
              strokeWidth={5}
              color={rate > 80 ? "green" : rate > 50 ? "amber" : "red"}
            />
          </div>
        );
      },
    },
    {
      accessorKey: "started_at",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Started At
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const date = new Date(row.getValue("started_at"));
        return <div>{date.toLocaleDateString()}</div>;
      },
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => {
        if (row.depth > 0) return null;
        const anyResponded = (row.original.email_logs || []).some(
          (l: any) => (l?.user_actions?.mail_replied?.length ?? 0) > 0
        );
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSelectedEmail(row.original)}>
                <EyeIcon className="h-4 w-4" />
                View details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onResponded(row.original.id)}>
                {anyResponded ? (
                  <CheckSquare className="h-4 w-4 text-green-600" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                {anyResponded ? "Responded ✓ (edit)" : "Who responded?"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
};
