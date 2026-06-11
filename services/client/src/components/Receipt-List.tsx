import { Plus, Trash2 } from "lucide-react";
import { Recipient } from "../types/email-types";
import { TemplateVariable } from "../types/template-types";
import { Button } from "./ui-component/Button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui-component/Card";
import { Input } from "./ui-component/Input";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui-component/Form";

interface RecipientListProps {
  recipients: string[];
  localVariables?: TemplateVariable[];
  onChange: (recipients: string[]) => void;
  control: any;
}
const RecipientList = ({
  recipients,
  localVariables,
  onChange,
  control,
}: RecipientListProps) => {
  const handleAddRecipient = () => {
    const newEmail = "";
    const newrecipientsList = [...recipients];
    newrecipientsList.push(newEmail);
    onChange(newrecipientsList);
  };

  const handleRemoveRecipient = (index: number) => {
    const newRecipients = [...recipients];
    newRecipients.splice(index, 1);
    onChange(newRecipients);
  };

  //   const handleEmailChange = (index: number, email: string) => {
  //     const newRecipients = [...recipients];
  //     newRecipients[index] = { ...newRecipients[index], email };
  //     onChange(newRecipients);
  //   };

  //   const handleVariableChange = (index: number, key: string, value: string) => {
  //     const newRecipients = [...recipients];
  //     newRecipients[index] = {
  //       ...newRecipients[index],
  //       variables: {
  //         ...newRecipients[index].variables,
  //         [key]: value,
  //       },
  //     };
  //     onChange(newRecipients);
  //   };

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
        <div className="space-y-6">
          {recipients && recipients.length > 0 ? (
            recipients.map((recipient, index) => (
              <div key={index}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex-1">
                    <FormField
                      control={control}
                      name={`recipients.${index}`}
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormControl>
                            <Input
                              // value={recipient.email}
                              {...field}
                              // onChange={(e) =>
                              //   handleEmailChange(index, e.target.value)
                              // }
                              placeholder="Email address"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    onClick={() => handleRemoveRecipient(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* {localVariables.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2 pl-2 pb-4 border-l-2 border-muted">
                    {localVariables.map((variable) => (
                      <div key={variable.key} className="space-y-1">
                        <label className="text-xs font-medium">
                          {variable.description || variable.key}
                        </label>
                        <Input
                          value={recipient.variables[variable.key] || ''}
                          onChange={(e) => handleVariableChange(index, variable.key, e.target.value)}
                          placeholder={variable.description || variable.key}
                          size="sm"
                          className="h-8"
                        />
                      </div>
                    ))}
                  </div>
                )} */}
              </div>
            ))
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground">No recipients added yet</p>
              <Button
                variant="outline"
                size="sm"
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
