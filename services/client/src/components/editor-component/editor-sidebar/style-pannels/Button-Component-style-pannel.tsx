import { useState } from "react";
import {
  Accordion,
} from "src/components/ui-component/Accordian";
import { Label } from "src/components/ui-component/Label";
import { useEditor } from "src/providers/email-editor/editor-provider";
import { Button } from "src/components/ui-component/Button";
import AccordianHOC from "./helper/Accordian-HOC";
import { getStyleValueForSelectedElement } from "src/lib/utils";
import { BORDER_STYLES, STYLE_PROPERTIES, TEXT_ALIGN_OPTIONS } from "src/lib/constants";
import OptionsPicker from "./reusable-components/OptionsPicker";
import NumberInput from "./reusable-components/NumberInput";
import ColorPicker from "./reusable-components/ColorPicker";
import SpacingControl from "./reusable-components/SpaceControl";
import { Input } from "src/components/ui-component/Input";
import { Slider } from "src/components/ui-component/Slider";

const ButtonComponentStyles = () => {
  const { state, dispatch } = useEditor();
  const { selectedElement } = state.editor;

  const [showAdvancedPadding, setShowAdvancedPadding] = useState(false);
  const [urlError, setUrlError] = useState("");

  // Get button content properties
  const buttonContent = !Array.isArray(selectedElement.content) ? selectedElement.content : {};
  const actionType = buttonContent?.actionType || "website";
  const url = buttonContent?.url || "";
  const target = buttonContent?.target || "sameTab";
  const buttonText = buttonContent?.innerText || "";

  const handleStyleChange = (e: {
    target: {
      id: string;
      value: string | number | Record<string, number>;
    };
  }) => {
    const styleSettings = e.target.id;
    let value = e.target.value;

    if (typeof value === "object") {
      dispatch({
        type: "UPDATE_ELEMENT",
        payload: {
          elementDetails: {
            ...selectedElement,
            styles: {
              ...selectedElement.styles,
              ...value,
            },
          },
        },
      });
    } else {
      dispatch({
        type: "UPDATE_ELEMENT",
        payload: {
          elementDetails: {
            ...selectedElement,
            styles: {
              ...selectedElement.styles,
              [styleSettings]: value,
            },
          },
        },
      });
    }
  };

  const handleContentChange = (field: string, value: string) => {
    const currentContent = !Array.isArray(selectedElement.content) ? selectedElement.content : {};
    
    // Clear URL error when action type changes
    if (field === "actionType") {
      setUrlError("");
    }
    
    // Validate URL on change
    if (field === "url") {
      validateUrl(value, actionType);
    }
    
    dispatch({
      type: "UPDATE_ELEMENT",
      payload: {
        elementDetails: {
          ...selectedElement,
          content: {
            ...currentContent,
            [field]: value,
          },
        },
      },
    });
  };

  const handleTextAlign = (value: any) => {
    dispatch({
      type: "UPDATE_ELEMENT",
      payload: {
        elementDetails: {
          ...selectedElement,
          styles: {
            ...selectedElement.styles,
            textAlign: value,
          },
        },
      },
    });
  };

  const handleWidthChange = (value: number[]) => {
    dispatch({
      type: "UPDATE_ELEMENT",
      payload: {
        elementDetails: {
          ...selectedElement,
          styles: {
            ...selectedElement.styles,
            width: `${value[0]}%`,
          },
        },
      },
    });
  };

  const getCurrentWidth = () => {
    const width = selectedElement.styles?.width;
    if (!width || width === "auto") return 100;
    return parseInt(width.toString().replace('%', ''), 10) || 100;
  };

  const actionTypeOptions = [
    { label: "Open Website", value: "website" },
    { label: "Send Email", value: "email" },
    { label: "Call Phone Number", value: "phone" },
  ];

  const targetOptions = [
    { label: "Same Tab", value: "sameTab" },
    { label: "New Tab", value: "newTab" },
  ];

  // Validation functions
  const validateUrl = (url: string, type: string) => {
    if (!url.trim()) {
      setUrlError("");
      return true;
    }

    switch (type) {
      case "website":
        const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
        if (!urlPattern.test(url)) {
          setUrlError("Please enter a valid URL (e.g., https://example.com)");
          return false;
        }
        break;
      case "email":
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(url)) {
          setUrlError("Please enter a valid email address");
          return false;
        }
        break;
      case "phone":
        const phonePattern = /^[\+]?[1-9]?[\d\s\-\(\)]{10,15}$/;
        if (!phonePattern.test(url)) {
          setUrlError("Please enter a valid phone number");
          return false;
        }
        break;
      default:
        break;
    }
    setUrlError("");
    return true;
  };

  return (
    <div className="h-full overflow-y-scroll">
      <Accordion
        type="multiple"
        className="w-full"
        defaultValue={["action", "button-options", "spacing"]}
      >
        {/* Action Section */}
        <AccordianHOC value="action" title="Action">
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">Action Type</Label>
              <OptionsPicker
                value={actionType}
                label=""
                options={actionTypeOptions}
                placeHolder="Select action type"
                onChange={(value) => handleContentChange("actionType", value)}
              />
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">
                {actionType === "website" ? "URL" : actionType === "email" ? "Email Address" : "Phone Number"}
              </Label>
              <Input
                value={url}
                onChange={(e) => handleContentChange("url", e.target.value)}
                placeholder={
                  actionType === "website" 
                    ? "https://example.com" 
                    : actionType === "email" 
                    ? "contact@example.com" 
                    : "+1234567890"
                }
                className={urlError ? "border-red-500" : ""}
              />
              {urlError && (
                <p className="text-red-500 text-xs mt-1">{urlError}</p>
              )}
            </div>

            {actionType === "website" && (
              <div>
                <Label className="text-sm text-muted-foreground">Target</Label>
                <OptionsPicker
                  value={target}
                  label=""
                  options={targetOptions}
                  placeHolder="Select target"
                  onChange={(value) => handleContentChange("target", value)}
                />
              </div>
            )}

            <div>
              <Label className="text-sm text-muted-foreground">Button Text</Label>
              <Input
                value={buttonText}
                onChange={(e) => handleContentChange("innerText", e.target.value)}
                placeholder="Button"
              />
            </div>
          </div>
        </AccordianHOC>

        {/* Button Options Section */}
        <AccordianHOC value="button-options" title="Button Options">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">
                  Background Color
                </Label>
                <ColorPicker
                  id="backgroundColor"
                  value={String(
                    getStyleValueForSelectedElement(STYLE_PROPERTIES.backgroundColor, state) || "#007bff"
                  )}
                  onChange={handleStyleChange}
                  label=""
                />
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">
                  Text Color
                </Label>
                <ColorPicker
                  id="color"
                  value={String(
                    getStyleValueForSelectedElement(STYLE_PROPERTIES.color, state) || "#ffffff"
                  )}
                  onChange={handleStyleChange}
                  label=""
                />
              </div>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">
                Width
              </Label>
              <div className="flex items-center justify-end mb-2">
                <small className="p-2">
                  {getCurrentWidth()}%
                </small>
              </div>
              <Slider
                value={[getCurrentWidth()]}
                onValueChange={handleWidthChange}
                max={100}
                min={10}
                step={1}
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <NumberInput
                id={STYLE_PROPERTIES.lineHeight.key}
                value={getStyleValueForSelectedElement(
                  STYLE_PROPERTIES.lineHeight,
                  state
                )}
                defaultValue={"1.5"}
                onChange={handleStyleChange}
                label={STYLE_PROPERTIES.lineHeight.label}
                min={0.5}
                max={3}
                step={0.1}
                allowDecimals={true}
                unit=""
              />
              <NumberInput
                id={STYLE_PROPERTIES.letterSpacing.key}
                value={getStyleValueForSelectedElement(
                  STYLE_PROPERTIES.letterSpacing,
                  state
                )}
                defaultValue={"0"}
                onChange={handleStyleChange}
                label="Letter Spacing"
                min={-2}
                max={5}
                step={0.1}
                allowDecimals={true}
                unit="px"
              />
            </div>
          </div>
        </AccordianHOC>

        {/* Spacing Section */}
        <AccordianHOC value="spacing" title="Spacing">
          <div className="space-y-4">
            {/* Text Align */}
            <div className="flex flex-col gap-1">
              <Label className="text-sm text-muted-foreground">Alignment</Label>
              <div className="flex border rounded-md p-1">
                {TEXT_ALIGN_OPTIONS.map(({ value, icon: Icon }) => (
                  <Button
                    key={value}
                    type="button"
                    variant={
                      getStyleValueForSelectedElement(
                        STYLE_PROPERTIES.textAlign,
                        state
                      ) === value
                        ? "default"
                        : "ghost"
                    }
                    className="flex-1 h-8"
                    onClick={() => handleTextAlign(value)}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                ))}
              </div>
            </div>

            {/* Padding */}
            <SpacingControl
              allSidesId={STYLE_PROPERTIES.padding.key}
              allSidesValue={getStyleValueForSelectedElement(
                STYLE_PROPERTIES.padding,
                state
              )}
              topId={STYLE_PROPERTIES.paddingTop.key}
              topValue={getStyleValueForSelectedElement(
                STYLE_PROPERTIES.paddingTop,
                state
              )}
              rightId={STYLE_PROPERTIES.paddingRight.key}
              rightValue={getStyleValueForSelectedElement(
                STYLE_PROPERTIES.paddingRight,
                state
              )}
              bottomId={STYLE_PROPERTIES.paddingBottom.key}
              bottomValue={getStyleValueForSelectedElement(
                STYLE_PROPERTIES.paddingBottom,
                state
              )}
              leftId={STYLE_PROPERTIES.paddingLeft.key}
              leftValue={getStyleValueForSelectedElement(
                STYLE_PROPERTIES.paddingLeft,
                state
              )}
              onChange={handleStyleChange}
              label="Padding"
              showAdvanced={showAdvancedPadding}
              onAdvancedToggle={() => setShowAdvancedPadding(!showAdvancedPadding)}
              unit={STYLE_PROPERTIES.padding.units![0]}
            />

            {/* Border */}
            <div className="space-y-4">
              <Label className="text-sm text-muted-foreground">Border</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Style</Label>
                  <OptionsPicker
                    value={String(selectedElement.styles?.borderStyle || "none")}
                    label=""
                    options={BORDER_STYLES}
                    placeHolder="Select border style"
                    onChange={(value) =>
                      handleStyleChange({
                        target: { id: "borderStyle", value },
                      })
                    }
                  />
                </div>
                <div>
                  <NumberInput
                    id="borderWidth"
                    value={String(
                      selectedElement.styles?.borderWidth || "0"
                    ).replace('px', '')}
                    onChange={handleStyleChange}
                    label="Width"
                    min={0}
                    max={10}
                    unit="px"
                    defaultValue={0}
                  />
                </div>
              </div>
              <div>
                <ColorPicker
                  id="borderColor"
                  value={String(
                    selectedElement.styles?.borderColor || "#000000"
                  )}
                  onChange={handleStyleChange}
                  label="Color"
                />
              </div>
            </div>

            {/* Rounded Border */}
            <div>
              <NumberInput
                id="borderRadius"
                value={String(
                  selectedElement.styles?.borderRadius || "4"
                ).replace('px', '')}
                onChange={handleStyleChange}
                label="Rounded Border"
                min={0}
                max={50}
                unit="px"
                defaultValue={4}
              />
            </div>
          </div>
        </AccordianHOC>
      </Accordion>
    </div>
  );
};

export default ButtonComponentStyles; 