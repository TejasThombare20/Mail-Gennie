import { Badge } from "../components/ui-component/Badge";
import { cn } from "./utils";

export const StatusBadge = ({ status }: { status: string }) => {
    return (
      <Badge
        className={cn(
          "hover:bg-opacity-80",
          status === "sent" && "bg-green-100 text-green-800",
          status === "failed" && "bg-red-100 text-red-800",
          status === "invalid" && "bg-yellow-100 text-yellow-800",
          !["sent", "failed", "invalid"].includes(status) && "border"
        )}
      >
        {status.charAt(0).toUpperCase() + status.slice(1) || "Unknown"}
      </Badge>
    );
  };