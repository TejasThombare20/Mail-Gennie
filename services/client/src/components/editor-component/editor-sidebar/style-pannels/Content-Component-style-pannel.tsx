import { useState } from "react";
import { v4 } from "uuid";
import { Accordion } from "src/components/ui-component/Accordian";
import { EditorElement, useEditor } from "src/providers/email-editor/editor-provider";
import AccordianHOC from "./helper/Accordian-HOC";
import { BORDER_STYLES, COLUMN_LAYOUTS } from "src/lib/constants";

import { Label } from "src/components/ui-component/Label";
import { Tabs, TabsList, TabsTrigger } from "src/components/ui-component/Tabs";
import { Button } from "src/components/ui-component/Button";
import { Plus, Trash2, Upload } from "lucide-react";
import { Input } from "src/components/ui-component/Input";
import { Switch } from "src/components/ui-component/Switch";
import OptionsPicker from "./reusable-components/OptionsPicker";
import NumberInput from "./reusable-components/NumberInput";
import ColorPicker from "./reusable-components/ColorPicker";

const ContentComponentStyles = () => {
  const { dispatch, state } = useEditor();
  const [activeTab, setActiveTab] = useState("column-1");

  const element = state.editor.selectedElement;

  // Helper function to find parent element by ID
  const findParentElement = (elements: EditorElement[], targetId: string): EditorElement | null => {
    for (const el of elements) {
      if (Array.isArray(el.content)) {
        // Check if any direct child has the target ID
        const hasDirectChild = el.content.some(child => child.id === targetId);
        if (hasDirectChild) {
          return el;
        }
        // Recursively search in nested content
        const parent = findParentElement(el.content, targetId);
        if (parent) return parent;
      }
    }
    return null;
  };

  // Helper function to check if element is a row section (child row)
  const isRowSection = (element: EditorElement): boolean => {
    return element.name === "row-section" || element.isChildRow === true;
  };

  // Get the target element for partitioning (parent row if current is row section)
  const getTargetElementForPartitioning = (): EditorElement => {
    if (isRowSection(element)) {
      // If current element is a row section, find its parent and use it for partitioning
      const parentElement = findParentElement(state.editor.elements, element.id);
      return parentElement || element;
    }
    return element;
  };

  const targetElement = getTargetElementForPartitioning();

  // Extract current column information from target element
  const columnCount = Array.isArray(targetElement.content)
    ? targetElement.content.length
    : 0;

  // Get the active column index (0-based)
  const activeColumnIndex = parseInt(activeTab.split("-")[1]) - 1;


  const handleLayoutChange = (layout: {
    label: string;
    value: string;
    columns: string[];
  }) => {
    const { columns } = layout;

    // Use target element (parent row if current is row section)
    const elementToUpdate = targetElement;

    // Collect all existing content from current row
    let allExistingContent: EditorElement[] = [];
    if (Array.isArray(elementToUpdate.content)) {
      // If already has sections, collect content from all sections
      if (elementToUpdate.content.some(child => child.name === "row-section")) {
        allExistingContent = elementToUpdate.content.flatMap(section => 
          Array.isArray(section.content) ? section.content : []
        );
      } else {
        // If normal row, keep existing content
        allExistingContent = elementToUpdate.content;
      }
    }

    // Create horizontal sections (side by side) with width proportions
    const updatedContent: EditorElement[] = columns.map((width: string, index: number) => {
      return {
        id: v4(),
        type: "container",
        name: "row-section",
        styles: {
          width: width, // Use width proportions for horizontal division
          height: "100%", // Full height of parent row
          minHeight: "200px", // Minimum height for usability
          padding: "8px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          // Remove borderRight - we'll use visual separators instead
        },
        // Put all existing content in the first section, leave others empty
        content: index === 0 ? allExistingContent : [],
        isChildRow: true, // Mark as child row to prevent further division
      };
    });

    dispatch({
      type: "UPDATE_ELEMENT", 
      payload: {
        elementDetails: {
          ...elementToUpdate,
          content: updatedContent,
          styles: {
            ...elementToUpdate.styles,
            display: "flex",
            flexDirection: "row", // Horizontal layout for side-by-side sections
            width: "100%",
            minHeight: "200px", // Minimum height for the row
            height: "auto", // Allow height to grow with content
          },
        },
      },
    });

    // Update selected element to first section if current element was a row section
    if (isRowSection(element) && updatedContent.length > 0) {
      dispatch({
        type: "CHANGE_CLICKED_ELEMENT",
        payload: { elementDetails: updatedContent[0] },
      });
    }
  };

  const handleStyleChange = (e: {
    target: {
      id: string;
      value: string | number | Record<string, number>;
    };
  }) => {
    const styleProperty = e.target.id;
    const value = e.target.value;

    if (activeTab === "container") {
      // Update container styles
      dispatch({
        type: "UPDATE_ELEMENT",
        payload: {
          elementDetails: {
            ...element,
            styles: {
              ...element.styles,
              [styleProperty]: value,
            },
          },
        },
      });
    } else {
      // Update column styles
      // const updatedContent = [...element.content];
      // updatedContent[activeColumnIndex] = {
      //   ...updatedContent[activeColumnIndex],
      //   styles: {
      //     ...updatedContent[activeColumnIndex].styles,
      //     [styleProperty]: value,
      //   },
      // };

      // dispatch({
      //   type: "UPDATE_ELEMENT",
      //   payload: {
      //     elementDetails: {
      //       ...element,
      //       content: updatedContent,
      //     },
      //   },
      // });
    }
  };

  const handleDeleteSection = (index: number) => {
    if(!Array.isArray(element.content)) return;

    if (Array.isArray(element.content) && element.content?.length <= 1) return;
    
    // Get content from the section being deleted
    const contentToPreserve = element.content[index].content || [];
    
    // Remove the section
    const updatedContent = element.content.filter(
      (_: any, i: number) => i !== index
    );

    // If there's content to preserve, add it to the first section
    if ( Array.isArray(contentToPreserve) && contentToPreserve.length > 0 && Array.isArray(updatedContent) &&  updatedContent.length > 0 && Array.isArray(updatedContent[0]?.content)) {
      updatedContent[0].content = [
        ...(updatedContent[0]?.content || []),
        ...contentToPreserve
      ];
    }

    // Recalculate widths to redistribute the space proportionally
    const totalWidth = 100;
    const equalWidth = Math.floor(totalWidth / updatedContent.length);
    const remainder = totalWidth - (equalWidth * updatedContent.length);
    
    updatedContent.forEach((section: any, i: number) => {
      // Add remainder to last section to ensure total equals 100%
      section.styles.width = i === updatedContent.length - 1
        ? `${equalWidth + remainder}%`
        : `${equalWidth}%`;
      
      // Update border for last section
      section.styles.borderRight = i < updatedContent.length - 1 ? "1px solid #e5e7eb" : "none";
    });

    dispatch({
      type: "UPDATE_ELEMENT",
      payload: {
        elementDetails: {
          ...element,
          content: updatedContent,
        },
      },
    });

    // Update active tab if needed
    if (index === activeColumnIndex) {
      setActiveTab("column-1");
    } else if (index < activeColumnIndex) {
      setActiveTab(`column-${activeColumnIndex}`);
    }
  };

  const handleInsertSection = (index: number) => {
    if (!Array.isArray(element.content)) return;
    const updatedContent = [...element.content];
    
    // Calculate new width distribution proportionally
    const totalSections = updatedContent.length + 1;
    const equalWidth = Math.floor(100 / totalSections);
    const remainder = 100 - (equalWidth * totalSections);
    
    // Update widths of existing sections
    updatedContent.forEach((section: any) => {
      section.styles.width = `${equalWidth}%`;
      section.styles.borderRight = "1px solid #e5e7eb";
    });

    // Create new section
    const newSection : EditorElement = {
      id: v4(),
      type: "container",
      name: "row-section",
      styles: {
        width: `${equalWidth + remainder}%`,
        height: "100%", 
        minHeight: "200px",
        padding: "8px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        borderRight: "none", // Last section has no border
      },
      content: [],
      isChildRow: true,
    };

    // Insert at the specified position
    updatedContent.splice(index + 1, 0, newSection);

    // Update border for the new last section
    updatedContent.forEach((section: any, i: number) => {
      section.styles.borderRight = i < updatedContent.length - 1 ? "1px solid #e5e7eb" : "none";
    });

    dispatch({
      type: "UPDATE_ELEMENT",
      payload: {
        elementDetails: {
          ...element,
          content: updatedContent,
        },
      },
    });

    // Select the newly inserted section
    setActiveTab(`column-${index + 2}`);
  };

  // Handle background image upload (mock implementation)
  const handleImageUpload = () => {
    // In a real implementation, this would handle file selection and upload
    const imageUrl = prompt("Enter image URL (for demo purposes):");
    if (imageUrl) {
      dispatch({
        type: "UPDATE_ELEMENT",
        payload: {
          elementDetails: {
            ...element,
            styles: {
              ...element.styles,
              backgroundImage: `url(${imageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            },
          },
        },
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();

    // In a real implementation, this would handle file upload
    const imageUrl = prompt("Enter image URL (for demo purposes):");
    if (imageUrl) {
      dispatch({
        type: "UPDATE_ELEMENT",
        payload: {
          elementDetails: {
            ...element,
            styles: {
              ...element.styles,
              backgroundImage: `url(${imageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            },
          },
        },
      });
    }
  };

  return (
    <div className="h-full overflow-y-scroll p-4">
      <Accordion
        type="multiple"
        defaultValue={[
          "columns",
          "column-properties",
          "row-properties",
          "responsive-design",
        ]}
      >
        {/* Row Division Section */}
        <AccordianHOC value="columns" title="Row Sections">
          <div className="grid grid-cols-2 gap-2">
            {COLUMN_LAYOUTS.map((layout) => (
              <div
                key={layout.value}
                className="border rounded p-2 cursor-pointer hover:border-blue-500 transition-colors"
                onClick={() => handleLayoutChange(layout)}
              >
                <div className="flex h-8 w-full">
                  {layout.columns.map((width, index) => (
                    <div
                      key={index}
                      className="relative h-full border-r last:border-r-0 bg-gray-200"
                      style={{ width }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center text-xs opacity-0 bg-blue-50/80 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                        {width}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-xs mt-1 text-center">{layout.label}</div>
              </div>
            ))}
          </div>
        </AccordianHOC>

        {/* Section Properties */}
        <AccordianHOC value="column-properties" title="Section Properties">
          <div className="space-y-4">
            {columnCount > 0 ? (
              <>
                <div className="flex overflow-x-auto pb-2 mb-4">
                  <Tabs>
                  <TabsList className="h-auto">
                    {Array.from({ length: columnCount }).map((_, index) => (
                      <TabsTrigger
                        key={`column-${index + 1}`}
                        value={`column-${index + 1}`}
                        className="flex items-center gap-2 px-3 py-1"
                        onClick={() => setActiveTab(`column-${index + 1}`)}
                      >
                        Column {index + 1}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  </Tabs>
                </div>

                <div className="flex justify-between mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                                            onClick={() => handleDeleteSection(activeColumnIndex)}
                    disabled={columnCount <= 1}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                                          Delete Section
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                                            onClick={() => handleInsertSection(activeColumnIndex)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Insert Section
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">
                        Background Color
                      </Label>
                      <ColorPicker
                        id="backgroundColor"
                        // value={
                        //   element.content[activeColumnIndex]?.styles
                        //     ?.backgroundColor || ""
                        // }
                        value=""
                        onChange={handleStyleChange}
                        label=""
                      />
                    </div>
                    <NumberInput
                      id="padding"
                      label="Padding"
                      // value={
                      //   element.content[activeColumnIndex]?.styles?.padding ||
                      //   "8px"
                      // }
                      value=""
                      onChange={handleStyleChange}
                      min={0}
                      max={100}
                      unit="px"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">
                        Border Style
                      </Label>
                      <OptionsPicker
                        // value={
                        //   element.content[activeColumnIndex]?.styles
                        //     ?.borderStyle || "none"
                        // }
                        value="none"
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
                      <Label className="text-sm text-muted-foreground">
                        Border Color
                      </Label>
                      <ColorPicker
                        id="borderColor"
                        // value={
                        //   element.content[activeColumnIndex]?.styles
                        //     ?.borderColor || ""
                        // }
                        value="#FFFFF"
                        onChange={handleStyleChange}
                        label=""
                      />
                    </div>
                  </div>

                  <NumberInput
                    id="borderWidth"
                    label="Border Width"
                    // value={
                    //   element.content[activeColumnIndex]?.styles
                    //     ?.borderWidth || "0px"
                    // }
                    value=""
                    onChange={handleStyleChange}
                    min={0}
                    max={10}
                    unit="px"
                  />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-20 border rounded border-dashed">
                <p className="text-sm text-muted-foreground">
                  No sections available
                </p>
              </div>
            )}
          </div>
        </AccordianHOC>
        <AccordianHOC title="Row Properties" value="row-properties">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">
                  Background Color
                </Label>
                <ColorPicker
                  id="backgroundColor"
                  value={element.styles?.backgroundColor || ""}
                  onChange={(e) =>
                    handleStyleChange({
                      target: {
                        id: "backgroundColor",
                        value: e.target.value,
                      },
                    })
                  }
                  label=""
                />
              </div>
              <NumberInput
                id="padding"
                label="Padding"
                value={element.styles?.padding || "8px"}
                onChange={(e) =>
                  handleStyleChange({
                    target: { id: "padding", value: e.target.value },
                  })
                }
                min={0}
                max={100}
                unit="px"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Background Image
              </Label>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  onClick={handleImageUpload}
                  className="flex items-center justify-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Upload Image
                </Button>

                <div
                  className="border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover:border-blue-500 transition-colors"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-6 w-6 text-gray-400" />
                    <p className="text-sm text-muted-foreground">
                      Drag and drop image here
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">
                    Image URL
                  </Label>
                  <Input
                    placeholder="https://example.com/image.jpg"
                    value={
                      element.styles?.backgroundImage?.replace(
                        /url\(['"](.+)['"]\)/,
                        "$1"
                      ) || ""
                    }
                    onChange={(e) =>
                      handleStyleChange({
                        target: {
                          id: "backgroundImage",
                          value: e.target.value
                            ? `url('${e.target.value}')`
                            : "",
                        },
                      })
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </AccordianHOC>

        {/* Row Properties Section */}

        {/* Responsive Design Section */}
        <AccordianHOC title="Responsive Design" value="responsive-design">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Hide on Desktop</Label>
              <Switch
                disabled
                aria-label="Toggle desktop visibility"
                // pressed={element.styles?.display === "none"}
              />
            </div>
            <p className="text-xs text-muted-foreground italic">
              (Upcoming Feature)
            </p>
          </div>
        </AccordianHOC>
      </Accordion>
    </div>
  );
};

export default ContentComponentStyles
