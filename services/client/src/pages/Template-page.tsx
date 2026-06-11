import React, { useEffect, useState } from "react";
import { useHandleApiError } from "../handlers/useErrorToast";
import { useSuccessToast } from "../handlers/use-success-toast";
import apiHandler, { ApiError } from "../handlers/api-handler";
import { EmailTemplate } from "../types/template-types";
import { useParams } from "react-router-dom";
import { getUserTemplatesApiResponse } from "../types/api-response-type";
import EmptyState from "../components/Empty-State";
import { LayoutTemplate } from "lucide-react";
import ErrorState from "../components/Error-state";
import EmailTemplateForm from "../components/Email-template-form";
import LoadingState from "../components/Loading-state";

const Templatepage = () => {
  const { templateId } = useParams();

  const showErrorToast = useHandleApiError();
  const showSuccessToast = useSuccessToast();
  const [templateData, setTemplateData] =
    useState<getUserTemplatesApiResponse>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);

  useEffect(() => {
    if (templateId === "new") {
      return;
    }
    const fetchTemplate = async () => {
      try {
        setIsLoading(true);
        const templatedata = await apiHandler.get<getUserTemplatesApiResponse>(
          `/api/templates/${templateId}`
        );
        console.log("TemplateData", templatedata.data);
        setTemplateData(templatedata.data!);
        showSuccessToast("Template data loaded ...");
        setIsLoading(false);
      } catch (error) {
        setIsError(true);
        setIsLoading(false);
        showErrorToast(error as ApiError);
      }
    };
    fetchTemplate();
  }, [templateId]);

  return (
    <main className="w-full justify-center items-center  ">
      {isError ? (
        <>
          <ErrorState message="failed to fetch template,Please retry" />
        </>
      ) : isLoading ? (
        <>
          <LoadingState />
        </>
      ) : !isLoading && !templateData?.id && templateId !== "new" ? (
        <EmptyState
          icon={<LayoutTemplate />}
          title="Template not found"
          description="Unauthorized Access or Template can be deleted"
        />
      ) : (
        <EmailTemplateForm template={templateData} />
      )}
    </main>
  );
};

export default Templatepage;
