import React, { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui-component/Card";
import { Button } from "./ui-component/Button";
import { ScrollArea } from "./ui-component/Scroll-Area";
import { Input } from "./ui-component/Input";
import {
  TemplateVariable,
  GlobalTemplateVariable,
} from "../types/template-types";
import { Textarea } from "./ui-component/Text-Area";
import { cn } from "../lib/utils";
import { UUIDTypes, v4 as uuidv4 } from "uuid";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "./ui-component/Form";
import { UseFieldArrayRemove } from "react-hook-form";
import TooltipNote from "./Tooltips";

interface VariableManagerProps {
  variables: TemplateVariable[] | GlobalTemplateVariable[];
  onChange: (variables: TemplateVariable[] | GlobalTemplateVariable[]) => void;
  title: string;
  isGlobal?: boolean;
  formControl: any;
  isReadOnly?: boolean;
  isActionPerform?: boolean;
  remove?: UseFieldArrayRemove;
  append?: any;
  isGValueEditable?: boolean;
  tooltipDescription: string;
  tootipIcon: ReactNode;
}

const VariableManager = ({
  variables,
  onChange,
  title,
  isGlobal = false,
  formControl,
  isReadOnly = false,
  isActionPerform = true,
  remove,
  append,
  isGValueEditable,
  tooltipDescription,
  tootipIcon,
}: VariableManagerProps) => {
  const handleAddVariable = () => {
    if (isGlobal) {
      append(0, { key: "", id: uuidv4() });
    } else {
      append && append(0, { key: "", description: "", id: uuidv4() });
    }
  };

  return (
    <Card className="shadow-lg border border-gray-200 rounded-xl">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-md font-semibold text-gray-700">
          <div className="w-full flex justify-center items-center gap-2">
            <div>{title}</div>
            <aside>
              <TooltipNote description={tooltipDescription} icon={tootipIcon} />
            </aside>
          </div>
        </CardTitle>
        {isActionPerform && (
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={handleAddVariable}
            className="h-8 flex items-center gap-1 bg-blue-500 text-white hover:bg-blue-600"
          >
            <Plus className="h-4 w-4" /> Add
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[200px]  rounded-md border">
          <div className="space-y-3 my-2">
            {variables && variables.length > 0 ? (
              variables.map((variable, index) => (
                <div
                  key={variable.id}
                  className="w-full flex flex-row justify-center items-start gap-1 rounded-lg"
                >
                  <div className=" flex flex-row justify-center items-start w-full gap-2 ">
                    <FormField
                      control={formControl}
                      name={`${
                        isGlobal ? "global_variables" : "local_variables"
                      }.${index}.key`}
                      render={({ field }) => (
                        <FormItem
                          className={cn(
                            isGlobal ? "w-full" : "w-2/5 flex-grow"
                          )}
                        >
                          <FormControl>
                            <Input
                              {...field}
                              readOnly={isReadOnly}
                              disabled={isReadOnly}
                              placeholder={
                                isGlobal
                                  ? "e.g., companyName"
                                  : "e.g., firstName"
                              }
                              className={cn(
                                "h-8 border-gray-300 focus:ring-2 focus:ring-blue-400"
                              )}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {!isGlobal && (
                      <>
                        <FormField
                          control={formControl}
                          name={`${
                            isGlobal ? "global_variables" : "local_variables"
                          }.${index}.description`}
                          render={({ field }) => (
                            <FormItem className="w-3/5">
                              <FormControl>
                                <Textarea
                                  {...field}
                                  readOnly={isReadOnly}
                                  disabled={isReadOnly}
                                  value={field.value}
                                  placeholder="Describe a key"
                                  className="resize-none"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}
                    {isGValueEditable && (
                      <FormField
                        control={formControl}
                        name={`${
                          isGlobal ? "global_variables" : "local_variables"
                        }.${index}.value`}
                        render={({ field }) => (
                          <FormItem
                            className={cn(
                              isGlobal ? "w-full" : "w-3/5 flex-grow"
                            )}
                          >
                            <FormControl>
                              <Input
                                {...field}
                                placeholder={isGlobal ? "e.g.,apple.anc" : ""}
                                className={cn(
                                  "h-8 border-gray-300 focus:ring-2 focus:ring-blue-400"
                                )}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                  {isActionPerform && (
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      onClick={() => {
                        remove!(index);
                      }}
                      className=" h-8 w-8 hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                {isGlobal
                  ? "No global variables added yet. These variables will have the same value for all recipients."
                  : "No local variables added yet. These variables will have different values for each recipient."}
              </p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default VariableManager;
