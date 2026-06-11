import { useState } from "react";
import {
  Accordion,
} from "src/components/ui-component/Accordian";
import { Label } from "src/components/ui-component/Label";
import { useEditor } from "src/providers/email-editor/editor-provider";
import { Button } from "src/components/ui-component/Button";
import AccordianHOC from "./helper/Accordian-HOC";
import { getStyleValueForSelectedElement } from "src/lib/utils";
import { FONT_FAMILIES, FONT_WEIGHTS, STYLE_PROPERTIES, TEXT_ALIGN_OPTIONS } from "src/lib/constants";
import OptionsPicker from "./reusable-components/OptionsPicker";
import NumberInput from "./reusable-components/NumberInput";
import ColorPicker from "./reusable-components/ColorPicker";
import SpacingControl from "./reusable-components/SpaceControl";

const TextComponentStyles = () => {
  const { state, dispatch } = useEditor();
  const { selectedElement } = state.editor;

  const [showAdvancedPadding, setShowAdvancedPadding] = useState(false);
  const [showAdvancedMargin, setShowAdvancedMargin] = useState(false);

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

  return (
    <div className="h-full overflow-y-scroll">
    <Accordion
      type="multiple"
      className="w-full"
      defaultValue={["text", "links", "general"]}
    >
      <AccordianHOC value="text" title="Typography">
        <OptionsPicker
          label={STYLE_PROPERTIES.fontFamily.label}
          options = {FONT_FAMILIES}
          placeHolder="Select Font type"
          value={String(
            getStyleValueForSelectedElement(STYLE_PROPERTIES.fontFamily, state)
          )}
          onChange={(value) =>
            handleStyleChange({
              target: { id: STYLE_PROPERTIES.fontFamily.key, value },
            })
          }
        />
        <OptionsPicker
          value={String(
            getStyleValueForSelectedElement(STYLE_PROPERTIES.fontWeight, state)
          )}
          label={STYLE_PROPERTIES.fontWeight.label}
          options={FONT_WEIGHTS}
          placeHolder="Select Font weights"
          onChange={(value) =>
            handleStyleChange({
              target: { id: STYLE_PROPERTIES.fontWeight.key, value },
            })
          }
        />
        <div className="flex flex-row w-full justify-between items-center">
        <NumberInput
          id={STYLE_PROPERTIES.fontSize.key}
          value={String(
            getStyleValueForSelectedElement(STYLE_PROPERTIES.fontSize, state)
          )}
          onChange={handleStyleChange}
          label={STYLE_PROPERTIES.fontSize.label}
          min={5}
          max={1000}
          unit="px"
          defaultValue={16}
        />
        <ColorPicker
          id={STYLE_PROPERTIES.color.key}
          value={String(
            getStyleValueForSelectedElement(STYLE_PROPERTIES.color, state)
          )}
          onChange={handleStyleChange}
          label={STYLE_PROPERTIES.color.label}
        />
        </div>
        {/* Text Align */}
        <div className="flex flex-col gap-1">
          <Label className="text-sm text-muted-foreground">Text Align</Label>
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


         
        {/* Line Height */}
        <div className="flex flex-row w-full justify-between items-center">
        <NumberInput
          id={STYLE_PROPERTIES.lineHeight.key}
          value={getStyleValueForSelectedElement(
            STYLE_PROPERTIES.lineHeight,
            state
          )}
          defaultValue={"1"}
          onChange={handleStyleChange}
          label={STYLE_PROPERTIES.lineHeight.label}
          min={0}
          max={100}
          step={0.1}
          allowDecimals={true}
          unit={STYLE_PROPERTIES.lineHeight?.units![0]}
        />
        {/* Letter Spacing */}
        <NumberInput
          id={STYLE_PROPERTIES.letterSpacing.key}
          value={getStyleValueForSelectedElement(
            STYLE_PROPERTIES.letterSpacing,
            state
          )}
          defaultValue={"1"}
          onChange={handleStyleChange}
          label={STYLE_PROPERTIES.letterSpacing.label}
          min={-10}
          max={100}
          step={0.1}
          allowDecimals = {true}
          unit={STYLE_PROPERTIES.letterSpacing?.units![0]}
        />
        </div>


      </AccordianHOC>

      <AccordianHOC value="links" title="Links">
        <div>Upcoming Feature</div>
        {/* Inherit Body Style */}
        {/* <div className="flex items-center justify-between py-2">
            <Label className="text-sm text-muted-foreground">
              Inherit body style
            </Label>
            <Switch
              id="inheritBodyStyle"
              checked={getStyleValueForSelectedElement("inheritBodyStyle") === "true"}
              onCheckedChange={(checked) =>
                handleStyleChange({
                  target: {
                    id: "inheritBodyStyle",
                    value: checked ? "true" : "false",
                  },
                })
              }
            />
          </div> */}

        {/* Show these options only if not inheriting body style */}
        {/* {getStyleValueForSelectedElement("inheritBodyStyle") !== "true" && (
            <>
              <ColorPicker
                id="linkColor"
                value={getStyleValueForSelectedElement("linkColor")}
                onChange={handleStyleChange}
                label="Link Color"
              />

              <div className="flex items-center justify-between py-2">
                <Label className="text-sm text-muted-foreground">
                  Underline links
                </Label>
                <Switch
                  id="textDecoration"
                  checked={getStyleValueForSelectedElement("textDecoration") === "underline"}
                  onCheckedChange={(checked) =>
                    handleStyleChange({
                      target: {
                        id: "textDecoration",
                        value: checked ? "underline" : "none",
                      },
                    })
                  }
                />
              </div>
            </>
          )} */}
      </AccordianHOC>

      <AccordianHOC value="general" title="General">
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
          label="Container Padding"
          showAdvanced={showAdvancedPadding}
          onAdvancedToggle={() => setShowAdvancedPadding(!showAdvancedPadding)}
          unit={STYLE_PROPERTIES.padding.units![0]}
        />

        <SpacingControl
          allSidesId={STYLE_PROPERTIES.margin.key}
          allSidesValue={getStyleValueForSelectedElement(
            STYLE_PROPERTIES.margin,
            state
          )}
          topId={STYLE_PROPERTIES.marginTop.key}
          topValue={getStyleValueForSelectedElement(
            STYLE_PROPERTIES.marginTop,
            state
          )}
          rightId={STYLE_PROPERTIES.marginRight.key}
          rightValue={getStyleValueForSelectedElement(
            STYLE_PROPERTIES.marginRight,
            state
          )}
          bottomId={STYLE_PROPERTIES.marginBottom.key}
          bottomValue={getStyleValueForSelectedElement(
            STYLE_PROPERTIES.marginBottom,
            state
          )}
          leftId={STYLE_PROPERTIES.marginLeft.key}
          leftValue={getStyleValueForSelectedElement(
            STYLE_PROPERTIES.marginLeft,
            state
          )}
          onChange={handleStyleChange}
          label="Container Margin"
          showAdvanced={showAdvancedMargin}
          onAdvancedToggle={() => setShowAdvancedMargin(!showAdvancedMargin)}
          unit={STYLE_PROPERTIES.margin.units![0]}
        />
      </AccordianHOC>
    </Accordion>
          
    </div>
  );
};

export default TextComponentStyles;
