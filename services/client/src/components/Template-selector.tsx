import { useEffect, useState } from "react";
import { EmailTemplate, GlobalTemplateVariable, TemplateVariable } from "../types/template-types";
import { Card, CardContent } from "./ui-component/Card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui-component/Select";
import apiHandler, { ApiError } from "../handlers/api-handler";
import { getUserTemplatesApiResponse } from "../types/api-response-type";
import { useHandleApiError } from "../handlers/useErrorToast";
import { useSuccessToast } from "../handlers/use-success-toast";
import EmptyState from "./Empty-State";
import { FilePlus2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ErrorState from "./Error-state";
import LoadingState from "./Loading-state";
import { Button } from "./ui-component/Button";
import { UseFormReturn } from "react-hook-form";


interface TemplateSelectorProps {
// form  : UseFormReturn<{
//   recipients: [string, ...string[]];
//   template: EmailTemplate;
//   subject: string;
//   local_variables: TemplateVariable[];
//   global_variables: Omit<GlobalTemplateVariable , "value">extends{values : string | undefined}[]?;
// }, any, undefined>
form : any
  value: EmailTemplate;
  onChange: (value: getUserTemplatesApiResponse) => void;
}

const TemplateSelector = ({
  form,
  value,
  onChange
}: TemplateSelectorProps) => {
  const showErrorToast = useHandleApiError();
  const showSuccessToast = useSuccessToast();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<
    getUserTemplatesApiResponse[] | []
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const fetchUserTempplates = async () => {
      try {
        setIsLoading(true);
        const userTempaltesData = await apiHandler.get<
          getUserTemplatesApiResponse[]
        >("/api/templates");
        setTemplates(userTempaltesData.data!);
        showSuccessToast("templates fetched successfully");
        setIsLoading(false);
      } catch (error) {
        setIsLoading(false);
        setIsError(true);
        console.log("error fetching templates", error);
        showErrorToast(error as ApiError);
      }
    };
    fetchUserTempplates();
  }, []);

  return (
    <div className="space-y-4">
      <Select
        value={value?.id}
        onValueChange={(id) => {
          const template = templates.find((t) => t.id === id);
          if (template) {
            form.setValue("global_variables", template.global_variables);
            form.setValue("local_variables", template.local_variables);
            onChange(template)
          }
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select an email template" />
        </SelectTrigger>
        <SelectContent>
          {isError ? (
            <ErrorState message="Some thing went wrong , while loading templates, please contact administrator" />
          ) : isLoading ? (
            <LoadingState />
          ) : !isLoading && templates?.length == 0 ? (
            <EmptyState
              icon={
                <Button
                  className="gap-2 "
                  onClick={() => navigate("/dashboard/templates/new")}
                >
                  <FilePlus2 />
                </Button>
              }
              title="No Templates Found"
              description="You haven't created any email templates yet. Click on the plus button to create a new template."
            />
          ) : (
            templates?.length > 0 &&
            templates?.map((template, index) => (
              <>
                <SelectItem key={template.id} value={template.id!}>
                  {template.name}
                </SelectItem>
              </>
            ))
          )}
        </SelectContent>
      </Select>

      {/* {value && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                Template: <span className="font-medium">{templates.find(t => t.id === value)?.name}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Category: <span className="font-medium">{templates.find(t => t.id === value)?.category}</span>
              </p>
            </CardContent>
          </Card>
        )} */}
    </div>
  );
};

export default TemplateSelector;
