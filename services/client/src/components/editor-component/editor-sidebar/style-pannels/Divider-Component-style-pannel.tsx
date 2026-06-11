import { useState } from "react";
import {
  Accordion,
} from "src/components/ui-component/Accordian";
import { useEditor } from "src/providers/email-editor/editor-provider";
import { Button } from "src/components/ui-component/Button";
import AccordianHOC from "./helper/Accordian-HOC";
import { getStyleValueForSelectedElement } from "src/lib/utils";
import NumberInput from "./reusable-components/NumberInput";
import ColorPicker from "./reusable-components/ColorPicker";
import SpacingControl from "./reusable-components/SpaceControl";


const DividerComponentStyles = () => {
  const { state, dispatch } = useEditor();

  const handleStyleChange = (e: any) => {
    const styleSettings = e.target ? e.target : e;

    const styleObject = {
      [styleSettings.id]: styleSettings.value,
    };

    dispatch({
      type: "UPDATE_ELEMENT",
      payload: {
        elementDetails: {
          ...state.editor.selectedElement,
          styles: {
            ...state.editor.selectedElement.styles,
            ...styleObject,
          },
        },
      },
    });
  };

  const handleOnChanges = (e: any) => {
    const styleSettings = e.target ? e.target : e;
    const styleObject = {
      [styleSettings.id]: styleSettings.value,
    };

    dispatch({
      type: "UPDATE_ELEMENT",
      payload: {
        elementDetails: {
          ...state.editor.selectedElement,
          styles: {
            ...state.editor.selectedElement.styles,
            ...styleObject,
          },
        },
      },
    });
  };

  return (
    <div className="h-full overflow-y-scroll">
    {/* <Accordion
      type="multiple"
      className="w-full"
      defaultValue={["divider", "spacing", "general"]}
    >
      <AccordianHOC value="divider" title="Divider Style">
        <ColorPicker
          id="borderTopColor"
          value={String(
            getStyleValueForSelectedElement({ key: "borderTopColor", defaultValue: "#000000" }, state) || "#000000"
          )}
          onChange={handleStyleChange}
          label="Divider Color"
        />
        <NumberInput
          id="borderTopWidth"
          value={String(
            getStyleValueForSelectedElement({ key: "borderTopWidth", defaultValue: "1" }, state) || "1"
          )}
          onChange={handleStyleChange}
          label="Thickness"
          min={1}
          max={10}
          unit="px"
          defaultValue={1}
        />
        <NumberInput
          id="width"
          value={String(
            getStyleValueForSelectedElement({ key: "width", defaultValue: "100" }, state) || "100"
          )}
          onChange={handleStyleChange}
          label="Width"
          min={10}
          max={100}
          unit="%"
          defaultValue={100}
        />
      </AccordianHOC>

      <AccordianHOC value="spacing" title="Spacing">
        <SpacingControl
          selectedElement={state.editor.selectedElement}
          device={state.editor.device}
          handleOnChanges={handleOnChanges}
        />
      </AccordianHOC>

      <AccordianHOC value="general" title="General">
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              dispatch({
                type: "DELETE_ELEMENT",
                payload: {
                  elementDetails: state.editor.selectedElement,
                },
              });
            }}
          >
            Delete Divider
          </Button>
        </div>
      </AccordianHOC>
    </Accordion> */}
    </div>
  );
};

export default DividerComponentStyles; 