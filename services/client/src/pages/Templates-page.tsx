import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  ChevronRight,
  LayoutTemplate,
  Paperclip,
  Plus,
} from "lucide-react";
import { Attachment } from "../types/attachment.type";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui-component/Card";
import { Badge } from "../components/ui-component/Badge";
import { EmailTemplate } from "../types/template-types";
import { Button } from "../components/ui-component/Button";
import AttachmentViewer from "../components/Attachment-Viewer";
import apiHandler, { ApiError } from "../handlers/api-handler";
import { getUserTemplatesApiResponse } from "../types/api-response-type";
import { useHandleApiError } from "../handlers/useErrorToast";
import { useSuccessToast } from "../handlers/use-success-toast";
import ErrorState from "../components/Error-state";
import EmptyState from "../components/Empty-State";
import LoadingState from "../components/Loading-state";

const templates: EmailTemplate[] = [
  {
    id: "1",
    name: "Welcome Email",
    category: "onboarding",
    attachments: [],
    local_variables: [
      {
        key: "firstName",
        description: "First name of the recipient",
        id: "b5d1297b-f37d-4256-9561-92b4fc632ec9",
      },
      {
        key: "lastName",
        description: "Last name of the recipient",
        id: "4b0009b0-524b-4670-8cf7-8fb69e4a7fd3",
      },
    ],

    global_variables: [
      { key: "companyName", id: "7a1c9293-0d95-43ee-b71a-ca95939a82c9" },
      { key: "supportEmail", id: "b83a9d01-cbe1-4de3-8a89-533fc90e5ae1" },
    ],
    json_data: {},
    html_content: "<div>Hello </div>",
  },

  {
    id: "2",
    name: "Monthly Newsletter",
    category: "marketing",
    attachments: [],
    local_variables: [
      {
        key: "subscriptionTier",
        description: "Subscription tier of the recipient",
        id: "b5d1297b-f37d-4256-9561-92b4fc632ec9",
      },
    ],
    global_variables: [
      { key: "monthName", id: "7a1c9293-0d95-43ee-b71a-ca95939a82c9" },
      { key: "promoCode", id: "b83a9d01-cbe1-4de3-8a89-533fc90e5ae1" },
    ],
    json_data: {},
    html_content: "<div>Hello </div>",
  },
];

const TemplateList = () => {
  const navigate = useNavigate();
  const showErrorToast = useHandleApiError();
  const showSuccessToast = useSuccessToast();
  const [selectedAttachment, setSelectedAttachment] =
    useState<Attachment | null>(null);
  const [templates, setTemplates] = useState<
    getUserTemplatesApiResponse[] | []
  >([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchTemplateData = async () => {
      try {
        setIsLoading(true);
        const templatesData = await apiHandler.get<
          getUserTemplatesApiResponse[]
        >("/api/templates");
        setTemplates(templatesData.data!);
        setIsLoading(false);
      } catch (error) {
        setError(true);
        setIsLoading(false);
        showErrorToast(error as ApiError);
      }
    };
    fetchTemplateData();
  }, []);

  // Function to handle template click
  const handleTemplateClick = (templateId: string) => {
    navigate(`/dashboard/templates/${templateId}`);
  };

  // Function to handle attachment click
  const handleAttachmentClick = (
    attachment: Attachment,
    e: React.MouseEvent
  ) => {
    e.stopPropagation(); 
    setSelectedAttachment(attachment);
    setIsDialogOpen(true);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold mb-6">Templates</h1>
        <Button
          onClick={() => navigate("/dashboard/templates/new")}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Template
        </Button>
      </div>

      <div>
        {error ? (
          <>
            <ErrorState message="failed to fetch templates , Please retry" />
          </>
        ) : isLoading ? (<LoadingState/>) : templates?.length === 0 && !isLoading ? (
          <EmptyState
            icon={<LayoutTemplate />}
            title="No Templates found !"
            description="Please create your first template"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates &&
              templates.map((template) => (
                <Card
                  key={template.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleTemplateClick(template?.id!)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{template.name}</span>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-600">
                          {new Date(template?.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <Badge variant="secondary" className="mb-2">
                        {template.category}
                      </Badge>

                      {template.attachmentsdata &&
                        template.attachmentsdata.length > 0 && (
                          <div className="border-t pt-3">
                            <p className="text-sm font-medium mb-2">
                              Attachments:
                            </p>
                            <div className="space-y-2">
                              {template.attachmentsdata.map(
                                (attachment : Attachment, idx) => (
                                  <div
                                    key={idx}
                                    onClick={(e) =>
                                      handleAttachmentClick(attachment, e)
                                    }
                                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                                  >
                                    <Paperclip className="h-4 w-4" />
                                    <span>{attachment.file_name}</span>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}
      </div>

      <AttachmentViewer
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        attachment={selectedAttachment!}
      />
    </div>
  );
};

export default TemplateList;
