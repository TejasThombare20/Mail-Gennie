import {
  Pagination,
  PaginationContent,
  PaginationItem
} from "./ui-component/Pagination";
import { getEmailLogsApiResponse } from "../types/email-logs";
import { Table } from "@tanstack/react-table";
import { Button } from "./ui-component/Button";

interface PaginationComponentProps {
  table: Table<getEmailLogsApiResponse>;
}
const PaginationComponent = ({ table }: PaginationComponentProps) => {
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <Button
           className="disabled:cursor-none"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
        </PaginationItem>

        <div className="flex-1 px-3 text-center text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount() || 1} · {table.getRowCount()} session(s)
        </div>

        <PaginationItem>
          <Button
          variant="default"
            size="sm"
            className="ml-2 disabled:cursor-none"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
            </Button>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
};

export default PaginationComponent;
