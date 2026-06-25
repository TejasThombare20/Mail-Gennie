import { Braces, Info, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui-component/Card";
import { Input } from "./ui-component/Input";
import TooltipNote from "./Tooltips";

export interface BatchGlobalVar {
  key: string;
  id: string;
  description?: string;
  value?: string;
}

export interface BatchLocalVar {
  key: string;
  id: string;
  description?: string;
}

export interface TemplateBatchConfig {
  templateId: string;
  name: string;
  templateNumber: number | null;
  subject: string;
  globals: BatchGlobalVar[];
  locals: BatchLocalVar[];
}

interface TemplateBatchConfigCardProps {
  config: TemplateBatchConfig;
  /** True for the template chosen in the "Email Template" dropdown. */
  isSelected: boolean;
  /** How many recipients are routed to this template (for the header hint). */
  recipientCount: number;
  onSubjectChange: (subject: string) => void;
  /** Editing a global value syncs the SAME key across all templates upstream. */
  onGlobalValueChange: (key: string, value: string) => void;
}

/**
 * TemplateBatchConfigCard — one card per template actually used in the batch.
 * Shows that template's Subject (editable, prefilled from its default), its
 * Global variables (read-only keys + editable values), and its Local variables
 * (read-only chips — these are AI-filled per recipient).
 *
 * Shared global keys (e.g. company_name) stay in sync across cards: the parent
 * propagates a value change for a key to every template that declares it.
 */
const TemplateBatchConfigCard = ({
  config,
  isSelected,
  recipientCount,
  onSubjectChange,
  onGlobalValueChange,
}: TemplateBatchConfigCardProps) => {
  return (
    <Card className="border">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          {config.templateNumber !== null && (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              Template #{config.templateNumber}
            </span>
          )}
          <span className="font-semibold">{config.name}</span>
          {isSelected && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
              selected
            </span>
          )}
          <span className="text-xs font-normal text-muted-foreground">
            · {recipientCount} recipient{recipientCount === 1 ? "" : "s"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Subject */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Subject
          </label>
          <Input
            value={config.subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            placeholder="Subject (leave blank to use the template default)"
          />
        </div>

        {/* Global variables (editable values) */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            Global variables
            <TooltipNote
              description="Same value for every recipient of this template. Shared keys (e.g. company_name) stay in sync across templates. Leave AI-generated ones (e.g. product_info) blank to auto-fill."
              icon={<Info />}
            />
          </label>
          {config.globals.length > 0 ? (
            <div className="space-y-2">
              {config.globals.map((g) => (
                <div key={g.id} className="flex items-center gap-2">
                  <span
                    className="w-2/5 truncate rounded-md border bg-muted/40 px-2 py-1.5 font-mono text-xs"
                    title={g.description || g.key}
                  >
                    {`{{${g.key}}}`}
                  </span>
                  <Input
                    value={g.value ?? ""}
                    onChange={(e) => onGlobalValueChange(g.key, e.target.value)}
                    placeholder={g.description || "value"}
                    className="h-8 flex-1 text-sm"
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              This template has no global variables.
            </p>
          )}
        </div>

        {/* Local variables (read-only, AI-filled per recipient) */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-medium text-violet-700 dark:text-violet-300">
            <Sparkles className="h-3.5 w-3.5" />
            Local variables (AI-filled per recipient)
          </label>
          {config.locals.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {config.locals.map((v) => (
                <span
                  key={v.id ?? v.key}
                  title={v.description || v.key}
                  className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-white/70 px-2 py-1 font-mono text-xs text-violet-800 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-200"
                >
                  <Braces className="h-3 w-3 text-violet-400" />
                  {v.key}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              This template has no local variables.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TemplateBatchConfigCard;
