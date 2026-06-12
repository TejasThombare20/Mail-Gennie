import { Sparkles, Wand2, Loader2, Info, Braces } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui-component/Card";
import { Textarea } from "./ui-component/Text-Area";
import { cn } from "../lib/utils";
import TooltipNote from "./Tooltips";
import { TemplateVariable } from "../types/template-types";

/** A generated first-name shown after the agent runs. */
export interface GeneratedName {
  email: string;
  firstName: string;
}

interface AiLocalVariablesProps {
  /** The local variables defined on the selected template (their keys are shown). */
  variables: TemplateVariable[];
  /** The extra prompt the user types to steer the AI naming. */
  extraPrompt: string;
  onExtraPromptChange: (value: string) => void;
  /** True while the batch request (which runs the agent server-side) is in flight. */
  isGenerating: boolean;
  /** Names revealed after a batch completes (most-recent run). */
  generatedNames?: GeneratedName[];
}

/**
 * Ai-Local-Variables — replaces the old disabled "Local Variables" card.
 *
 * Local variables (currently just `receiver_name`) are generated per-recipient
 * by the server-side Gemini agent, so instead of editable rows this card:
 *   1. lets the user type an OPTIONAL extra instruction that is fed into the
 *      agent prompt (e.g. "these are all college seniors, add Sir/Ma'am"), and
 *   2. animates a "generating with AI" state while the batch is processed, then
 *      reveals the generated names.
 */
const AiLocalVariables = ({
  variables,
  extraPrompt,
  onExtraPromptChange,
  isGenerating,
  generatedNames = [],
}: AiLocalVariablesProps) => {
  return (
    <Card
      className={cn(
        "relative overflow-hidden rounded-xl border transition-all",
        "border-violet-200 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50",
        "dark:border-violet-900/50 dark:from-violet-950/30 dark:via-background dark:to-fuchsia-950/20",
        isGenerating && "animate-ai-glow border-violet-400"
      )}
    >
      {/* Shimmer sweep overlay, only while generating. */}
      {isGenerating && (
        <div
          className="pointer-events-none absolute inset-0 animate-ai-shimmer bg-[length:200%_100%] opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(110deg, transparent 30%, rgba(167,139,250,0.25) 50%, transparent 70%)",
          }}
        />
      )}

      <CardHeader className="relative flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-md font-semibold">
          <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300">
            <Sparkles
              className={cn("h-4 w-4", isGenerating && "animate-pulse")}
            />
            <span>Local Variables</span>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
              AI generated
            </span>
            <TooltipNote
              description="Local variables (like the recipient's first name) are generated per-recipient by AI from each email address and any per-recipient note. Add an optional instruction below to steer naming for the whole batch."
              icon={<Info />}
            />
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="relative space-y-3">
        {/* Template variable keys — these are the per-recipient placeholders the
            AI fills in. Read-only: they come from the selected template. */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-medium text-violet-700 dark:text-violet-300">
            <Braces className="h-3.5 w-3.5" />
            Template variables (auto-filled per recipient)
          </label>
          {variables.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {variables.map((v) => (
                <span
                  key={v.id ?? v.key}
                  title={v.description || v.key}
                  className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-white/70 px-2 py-1 font-mono text-xs text-violet-800 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-200"
                >
                  <span className="text-violet-400">{"{{"}</span>
                  <span className="font-medium">{v.key}</span>
                  <span className="text-violet-400">{"}}"}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              This template has no local variables.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-medium text-violet-700 dark:text-violet-300">
            <Wand2 className="h-3.5 w-3.5" />
            Extra instruction for the AI (optional)
          </label>
          <Textarea
            value={extraPrompt}
            onChange={(e) => onExtraPromptChange(e.target.value)}
            placeholder={
              'e.g. "All are college seniors — append Sir/Ma\'am" or "Prefer formal first names"'
            }
            className="min-h-[64px] resize-none border-violet-200 bg-white/70 focus-visible:ring-violet-400 dark:border-violet-900/50 dark:bg-background/50"
          />
        </div>

        {/* Generating state */}
        {isGenerating && (
          <div className="flex items-center gap-2 rounded-md bg-violet-100/70 px-3 py-2 text-sm text-violet-700 dark:bg-violet-900/30 dark:text-violet-200">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Generating first names with AI…</span>
          </div>
        )}

        {/* Revealed results */}
        {!isGenerating && generatedNames.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Last generated names
            </p>
            <div className="flex flex-wrap gap-1.5">
              {generatedNames.map((g, i) => (
                <span
                  key={g.email}
                  style={{ animationDelay: `${i * 60}ms` }}
                  className="animate-ai-reveal inline-flex items-center gap-1 rounded-full border border-violet-200 bg-white px-2.5 py-1 text-xs text-violet-800 shadow-sm dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-200"
                  title={g.email}
                >
                  <Sparkles className="h-3 w-3 text-violet-500" />
                  {g.firstName ? (
                    <span className="font-medium">{g.firstName}</span>
                  ) : (
                    <span className="italic text-muted-foreground">
                      (no name)
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    · {g.email.split("@")[0]}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {!isGenerating && generatedNames.length === 0 && (
          <p className="text-xs text-muted-foreground">
            First names are generated automatically when you send. Add a
            per-recipient note next to each email for extra context (e.g.
            "college senior", "manager").
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default AiLocalVariables;
