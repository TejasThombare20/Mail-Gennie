import React, { useRef, useEffect, useState } from "react";
import { TemplateData } from "../types/template-types";

import axios from "axios";
import { useToast } from "./ui-component/Use-toast";
import { Input } from "./ui-component/Input";
import { Select } from "./ui-component/Select";
import { Button } from "./ui-component/Button";
import EmailEditor, { EditorRef } from "react-email-editor";

const EmailTemplateEditor = () => {
  const emailEditorRef = useRef<EditorRef | null>(null);
  const [templateData, setTemplateData] = useState<TemplateData>({
    name: "",
    category: "general",
    json_data: null,
    html_content: "",
    attachments: [],
    globalVariables : [],
    localVariables : []
  });
  const { toast } = useToast();

  const categories = [
    { value: "general", label: "General" },
    { value: "marketing", label: "Marketing" },
    { value: "notification", label: "Notification" },
  ];

  // useEffect(() => {
  //   // Load Unlayer editor
  //   if (emailEditorRef.current) {
  //     emailEditorRef.current.loadDesign(templateData.json_data);
  //   }
  // }, []);

  const handleSave = async () => {
    try {
      // Get design JSON and HTML from Unlayer

      if (emailEditorRef.current) {
        console.log("Helllo");
        emailEditorRef.current.editor?.exportHtml(async (data: any) => {
          const { design, html } = data;

          console.log("Template JSON:", JSON.stringify(design, null, 2));
          console.log("Template HTML:", html);

          // Create form data for multipart submission
          const formData = new FormData();
          formData.append("name", templateData.name);
          formData.append("category", templateData.category);
          formData.append("json_data", JSON.stringify(design));
          formData.append("html_content", html);

          // Append attachments if any
          templateData.attachments?.forEach((file) => {
            formData.append("attachments", file);
          });

          // Save template
          await axios.post("http://localhost:8000/api/templates", formData, {
            headers: {
              "Content-Type": "multipart/form-data",
            },
            withCredentials: true, // To include cookies
          });

          toast({
            title: "Success",
            description: "Template saved successfully",
          });
        });
      } else {
        console.log("no template saved", emailEditorRef);
      }
    } catch (error) {
      console.log(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save template",
      });
    }
  };

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setTemplateData((prev) => ({
      ...prev,
      attachments: [...(prev.attachments || []), ...files],
    }));
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex gap-4">
        <Input
          placeholder="Template Name"
          value={templateData.name}
          onChange={(e) =>
            setTemplateData((prev) => ({ ...prev, name: e.target.value }))
          }
          className="max-w-xs"
        />
        <Select
          value={templateData.category}
          onValueChange={(value) =>
            setTemplateData((prev) => ({ ...prev, category: value }))
          }
        >
          {categories.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </Select>
        <Input
          type="file"
          multiple
          onChange={handleAttachmentChange}
          className="max-w-xs"
        />
        <Button onClick={handleSave}>Save Template</Button>
      </div>

      <div className="h-[800px] border rounded-lg">
        {/* <EmailEditor
            ref={emailEditorRef}
            onLoad={() => {
              // Configure Unlayer options here
              emailEditorRef.current?.editor.loadDesign(templateData.json_data);
            }}
            options={{
              features: {
                imageEditor: true,
                // textEditor: true
              },
              tools: {
                image: {
                  enabled: true,
                  properties: {
                    src: {
                      value: ''
                    }
                  }
                }
              }
            }}
          /> */}
        <EmailEditor ref={emailEditorRef} />
      </div>
    </div>
  );
};

export default EmailTemplateEditor;
