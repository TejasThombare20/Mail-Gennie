import React, { useEffect, useState, useCallback } from "react";
import apiHandler from "../handlers/api-handler";
import { useHandleApiError } from "../handlers/useErrorToast";
import { Input } from "../components/ui-component/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui-component/Select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui-component/Table";
import { Button } from "../components/ui-component/Button";
import { Badge } from "../components/ui-component/Badge";
import { Search, ChevronLeft, ChevronRight, Mail } from "lucide-react";
import { formatDate } from "../lib/utils";
import ThemeToggle from "../components/Theme-toggle";

interface SentEmailRecord {
  id: string;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  sent_at: string;
  type: "sent" | "imported";
  is_valid?: "not_verified" | "valid" | "failed";
  created_at: string;
}

interface RecordsResponse {
  records: SentEmailRecord[];
  total: number;
  page: number;
  totalPages: number;
}

// `embedded` = rendered inside the dashboard layout (sidebar + header already
// present), so we hide this page's own standalone top bar.
const SentRecordsPage = ({ embedded = false }: { embedded?: boolean }) => {
  const [records, setRecords] = useState<SentEmailRecord[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const showErrorToast = useHandleApiError();

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: page.toString() });
      if (selectedCompany && selectedCompany !== "all") {
        params.set("company", selectedCompany);
      }
      const response = await apiHandler.get<RecordsResponse>(
        `/api/sent-records?${params.toString()}`
      );
      if (response.success && response.data) {
        setRecords(response.data.records);
        setTotalPages(response.data.totalPages);
        setTotal(response.data.total);
      }
    } catch (error: any) {
      showErrorToast(error);
    } finally {
      setLoading(false);
    }
  }, [page, selectedCompany]);

  const fetchCompanies = async () => {
    try {
      const response = await apiHandler.get<string[]>(
        "/api/sent-records/companies"
      );
      if (response.success && response.data) {
        setCompanies(response.data);
      }
    } catch (error: any) {
      showErrorToast(error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setIsSearching(false);
      fetchRecords();
      return;
    }
    try {
      setLoading(true);
      setIsSearching(true);
      const response = await apiHandler.get<SentEmailRecord[]>(
        `/api/sent-records/search?q=${encodeURIComponent(searchQuery.trim())}`
      );
      if (response.success && response.data) {
        setRecords(response.data);
        setTotalPages(1);
        setTotal(response.data.length);
      }
    } catch (error: any) {
      showErrorToast(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    if (!isSearching) {
      fetchRecords();
    }
  }, [page, selectedCompany, fetchRecords]);

  const handleCompanyChange = (value: string) => {
    setSelectedCompany(value);
    setPage(1);
    setSearchQuery("");
    setIsSearching(false);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setIsSearching(false);
    setPage(1);
    fetchRecords();
  };

  // Sort records by sent_at descending (recently sent first) for display
  const sortedRecords = [...records].sort(
    (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
  );

  return (
    <div className={embedded ? "bg-background" : "min-h-screen bg-background"}>
      {/* Standalone top bar (only when not embedded in the dashboard layout) */}
      {!embedded && (
        <div className="border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold text-foreground">
                Sent Email Records
              </h1>
            </div>
            <ThemeToggle />
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Company filter */}
          <div className="w-full sm:w-64">
            <Select value={selectedCompany} onValueChange={handleCompanyChange}>
              <SelectTrigger>
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company} value={company}>
                    {company}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search */}
          <div className="flex flex-1 gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="pl-9"
              />
            </div>
            <Button onClick={handleSearch} variant="default">
              Search
            </Button>
            {isSearching && (
              <Button onClick={clearSearch} variant="outline">
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Results info */}
        <div className="text-sm text-muted-foreground mb-3">
          {isSearching
            ? `Found ${total} result${total !== 1 ? "s" : ""}`
            : `Showing page ${page} of ${totalPages} (${total} total records)`}
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>First Name</TableHead>
                <TableHead>Last Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Validity</TableHead>
                <TableHead>Sent At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Loading...
                    </div>
                  </TableCell>
                </TableRow>
              ) : sortedRecords.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-10 text-muted-foreground"
                  >
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                sortedRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {record.email}
                    </TableCell>
                    <TableCell>{record.first_name || "-"}</TableCell>
                    <TableCell>{record.last_name || "-"}</TableCell>
                    <TableCell>{record.company_name || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={record.type === "sent" ? "default" : "secondary"}
                      >
                        {record.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ValidityBadge value={record.is_valid} />
                    </TableCell>
                    <TableCell>{formatDate(record.sent_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {!isSearching && totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-6">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

const ValidityBadge = ({
  value,
}: {
  value?: "not_verified" | "valid" | "failed";
}) => {
  switch (value) {
    case "valid":
      return <Badge className="bg-green-600 text-white border-0">Valid</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    default:
      return <Badge variant="secondary">Not verified</Badge>;
  }
};

export default SentRecordsPage;
