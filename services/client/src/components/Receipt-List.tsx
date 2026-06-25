import { useState } from "react";
import {
  Plus,
  Trash2,
  Tag,
  ClipboardPaste,
  AlertCircle,
  X,
  TagsIcon,
} from "lucide-react";
import { Button } from "./ui-component/Button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui-component/Card";
import { Input } from "./ui-component/Input";
import { Textarea } from "./ui-component/Text-Area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui-component/Dialog";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "./ui-component/Form";
import {
  parseRecipientBlock,
  isValidEmail,
  parseTemplateNumber,
} from "../lib/recipient-paste-parser";

interface RecipientListProps {
  recipients: string[];
  /**
   * Per-recipient tags, index-aligned with `recipients`. Stored as a single
   * comma-separated string per recipient (kept that way for the AI-hint payload);
   * the UI splits it into individual badges.
   */
  recipientInfo: string[];
  onChange: (recipients: string[]) => void;
  onInfoChange: (recipientInfo: string[]) => void;
  control: any;
  /**
   * Template numbers the user actually has (from the loaded template list), so
   * a tag like "template 4" can be flagged when no such template exists.
   */
  availableTemplateNumbers?: number[];
}

/** Split a recipient's comma-separated tag string into trimmed, non-empty tags. */
const splitTags = (info: string): string[] =>
  info
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

const joinTags = (tags: string[]): string => tags.join(", ");

const RecipientList = ({
  recipients,
  recipientInfo,
  onChange,
  onInfoChange,
  control,
  availableTemplateNumbers = [],
}: RecipientListProps) => {
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);

  // Add-tag dialog state: which recipient we're adding a tag to, + the input.
  const [addTagFor, setAddTagFor] = useState<number | null>(null);
  const [newTag, setNewTag] = useState("");

  const handleAddRecipient = () => {
    onChange([...recipients, ""]);
    onInfoChange([...recipientInfo, ""]);
  };

  const handleRemoveRecipient = (index: number) => {
    const newRecipients = [...recipients];
    newRecipients.splice(index, 1);
    onChange(newRecipients);

    const newInfo = [...recipientInfo];
    newInfo.splice(index, 1);
    onInfoChange(newInfo);
  };

  const setTagsFor = (index: number, tags: string[]) => {
    const newInfo = [...recipientInfo];
    newInfo[index] = joinTags(tags);
    onInfoChange(newInfo);
  };

  const handleRemoveTag = (index: number, tagIdx: number) => {
    const tags = splitTags(recipientInfo[index] ?? "");
    tags.splice(tagIdx, 1);
    setTagsFor(index, tags);
  };

  const handleSaveNewTag = () => {
    if (addTagFor === null) return;
    const additions = splitTags(newTag);
    if (additions.length === 0) {
      setAddTagFor(null);
      setNewTag("");
      return;
    }
    const tags = [...splitTags(recipientInfo[addTagFor] ?? ""), ...additions];
    setTagsFor(addTagFor, tags);
    setNewTag("");
    setAddTagFor(null);
  };

  /**
   * Sync the recipient list to the textbox: the textbox is the source of truth.
   * Populate REPLACES the whole list with the parsed textbox content, so adding
   * a line adds a recipient and erasing a line removes it. The textbox content is
   * kept intact (not cleared) and the panel stays open so the user can keep
   * editing and re-populate.
   */
  const handleApplyPaste = () => {
    const parsed = parseRecipientBlock(pasteText);
    onChange(parsed.map((p) => p.email));
    onInfoChange(parsed.map((p) => p.tag));
    // Intentionally keep pasteText and the panel as-is.
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recipients</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => setShowPaste((s) => !s)}
          >
            <ClipboardPaste className="h-4 w-4 mr-1" /> Paste list
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={handleAddRecipient}
          >
            <Plus className="h-4 w-4 mr-1" /> Add Recipient
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {showPaste && (
          <div className="mb-4 space-y-2 rounded-md border border-dashed p-3">
            <p className="text-xs text-muted-foreground">
              One recipient per line as{" "}
              <code className="rounded bg-muted px-1">email - tag, tag</code>.
              Tags become AI notes; include <code>template N</code> to route that
              recipient to template #N.
            </p>
            <Textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={5}
              className="font-mono text-xs"
              placeholder={
                "johndoe@gmail.com - John \n" +
                "hm@acme.com - hiring manager, template 4"
              }
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setPasteText("")}
              >
                Clear
              </Button>
              <Button
                size="sm"
                type="button"
                onClick={handleApplyPaste}
                disabled={pasteText.trim() === ""}
              >
                Populate
              </Button>
            </div>
          </div>
        )}
        <div className="space-y-3">
          {recipients && recipients.length > 0 ? (
            recipients.map((recipient, index) => {
              const tags = splitTags(recipientInfo[index] ?? "");
              const emailInvalid =
                recipient.trim() !== "" && !isValidEmail(recipient);

              return (
                <div key={index} className="space-y-1">
                  {/* Email + all tags on one horizontal line (wraps if long). */}
                  <div className="flex flex-wrap items-center gap-2">
                    <FormField
                      control={control}
                      name={`recipients.${index}`}
                      render={({ field }) => (
                        <FormItem className="w-64 shrink-0">
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Email address"
                              className={
                                emailInvalid
                                  ? "border-red-400 focus-visible:ring-red-400"
                                  : undefined
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Tag badges */}
                    <div className="flex flex-1 flex-wrap items-center gap-1.5">
                      {tags.map((tag, tagIdx) => {
                        const templateNumber = parseTemplateNumber(tag);
                        const isTemplateTag = templateNumber !== null;
                        const unknownTemplate =
                          isTemplateTag &&
                          !availableTemplateNumbers.includes(templateNumber);

                        // Color: template tags are amber (or red if unknown);
                        // ordinary tags are violet.
                        const colorClasses = unknownTemplate
                          ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                          : isTemplateTag
                          ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
                          : "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-200";

                        return (
                          <span
                            key={`${tag}-${tagIdx}`}
                            className={`relative inline-flex items-center gap-1 rounded-md border px-2 py-1 pr-5 text-xs ${colorClasses}`}
                            title={
                              unknownTemplate
                                ? `No template #${templateNumber} exists`
                                : isTemplateTag
                                ? `Routes to template #${templateNumber}`
                                : tag
                            }
                          >
                            {isTemplateTag ? (
                              <TagsIcon className="h-3 w-3" />
                            ) : (
                              <Tag className="h-3 w-3 opacity-70" />
                            )}
                            <span className="font-medium">{tag}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(index, tagIdx)}
                              className="absolute -right-0.5 -top-1 rounded-full bg-background/80 p-0.5 text-muted-foreground hover:text-foreground"
                              aria-label={`Remove tag ${tag}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        );
                      })}

                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        className="h-7 px-2 text-xs text-muted-foreground"
                        onClick={() => {
                          setAddTagFor(index);
                          setNewTag("");
                        }}
                      >
                        <Plus className="mr-1 h-3 w-3" /> Add tag
                      </Button>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      className="shrink-0"
                      onClick={() => handleRemoveRecipient(index)}
                      aria-label="Remove recipient"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {emailInvalid && (
                    <p className="flex items-center gap-1 text-xs text-red-500">
                      <AlertCircle className="h-3 w-3" />
                      Not a valid email address
                    </p>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground">No recipients added yet</p>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={handleAddRecipient}
                className="mt-2"
              >
                Add your first recipient
              </Button>
            </div>
          )}
        </div>
      </CardContent>

      {/* Add-tag dialog */}
      <Dialog
        open={addTagFor !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAddTagFor(null);
            setNewTag("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a tag</DialogTitle>
            <DialogDescription>
              Add a note for the AI (e.g. "college senior") or route this
              recipient to a template with <code>template N</code>.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSaveNewTag();
              }
            }}
            placeholder='e.g. "college senior" or "template 4"'
          />
          <DialogFooter className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setAddTagFor(null);
                setNewTag("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveNewTag}
              disabled={newTag.trim() === ""}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default RecipientList;
