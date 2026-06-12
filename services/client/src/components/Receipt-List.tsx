import { Plus, Trash2, Tag } from "lucide-react";
import { Button } from "./ui-component/Button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui-component/Card";
import { Input } from "./ui-component/Input";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "./ui-component/Form";

interface RecipientListProps {
  recipients: string[];
  /** Per-recipient free-text hint (index-aligned with `recipients`). */
  recipientInfo: string[];
  onChange: (recipients: string[]) => void;
  onInfoChange: (recipientInfo: string[]) => void;
  control: any;
}
const RecipientList = ({
  recipients,
  recipientInfo,
  onChange,
  onInfoChange,
  control,
}: RecipientListProps) => {
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

  const handleInfoChange = (index: number, value: string) => {
    const newInfo = [...recipientInfo];
    newInfo[index] = value;
    onInfoChange(newInfo);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recipients</CardTitle>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={handleAddRecipient}
        >
          <Plus className="h-4 w-4 mr-1" /> Add Recipient
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recipients && recipients.length > 0 ? (
            recipients.map((_recipient, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="flex-1 space-y-2">
                  <FormField
                    control={control}
                    name={`recipients.${index}`}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormControl>
                          <Input {...field} placeholder="Email address" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {/* Per-recipient hint fed to the AI first-name agent. */}
                  <div className="relative">
                    <Tag className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-violet-400" />
                    <Input
                      value={recipientInfo[index] ?? ""}
                      onChange={(e) => handleInfoChange(index, e.target.value)}
                      placeholder='Optional note for AI — e.g. "college senior", "manager", "her name is Priya"'
                      className="h-8 pl-7 text-xs border-violet-200 bg-violet-50/40 placeholder:text-muted-foreground/70 focus-visible:ring-violet-400 dark:border-violet-900/50 dark:bg-violet-950/20"
                    />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  className="mt-0.5"
                  onClick={() => handleRemoveRecipient(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
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
    </Card>
  );
};

export default RecipientList;
