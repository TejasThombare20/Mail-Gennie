import clsx from "clsx";
import TabList from "./tab";
import SettingsTab from "./tab/tab-content/settings-tab";
import MediaBucketTab from "./tab/tab-content/media-bucket-tab";
import ComponentsTab from "./tab/components-tab";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../ui-component/Sheet";
import { Tabs, TabsContent } from "../../ui-component/Tabs";
import { EditorElement, useEditor } from "../../../providers/email-editor/editor-provider";
import ComponentTabContent from "./tab/tab-content/Component-tab-content";
import BlocksTabContent from "./tab/tab-content/Blocks-tab-content";
import StyleComponentLoader from "./helper/StyleComponentLoader";
import { CSSProperties, useEffect, useState } from "react";

type Props = {};

const EmailEditorSidebar = ({}: Props) => {
  const [selectedElement , SetSelectedElment] = useState<EditorElement>({id : "" ,styles : "" as CSSProperties, type : null, name :"" , content : []})
   const { state, dispatch } = useEditor();

  const selectedElementFromEditor = state.editor.selectedElement;
  useEffect(() => {
    SetSelectedElment(selectedElementFromEditor);
  }, [selectedElementFromEditor]);
  

  return (
    <>
    <Sheet open={true} modal={false}>
      <Tabs className="w-full " defaultValue="Components">
        <SheetContent
          showX={false}
          side="right"
          className={clsx(
            "mt-[97px] w-16  shadow-none  p-0 focus:border-none transition-all overflow-y-scroll",
            { hidden: state.editor.previewMode }
          )}
        >
          <TabList />
        </SheetContent>
        <SheetContent
          showX={false}
          side="right"
          className={clsx(
            "mt-[97px] w-80  shadow-none p-0 mr-16 bg-background h-full transition-all overflow-y-scroll ",
            { hidden: state.editor.previewMode }
          )}
        >
          <div className="grid gap-4 h-full pb-36 overflow-scroll ">
            <TabsContent value="Components">
              <ComponentTabContent />
            </TabsContent>
            <TabsContent value="blocks">
              {/* <SettingsTab /> */}
              <BlocksTabContent />
            </TabsContent>
            <TabsContent value="Media">
              {/* <MediaBucketTab subaccountId={subaccountId} /> */}
            </TabsContent>
          </div>
        </SheetContent>
      </Tabs>
    </Sheet>

    {
      selectedElementFromEditor && selectedElementFromEditor?.id && selectedElementFromEditor?.type 
        && !state.editor.previewMode && !state.editor.liveMode && (
          <div className="fixed top-[97px] right-0 w-80   h-[calc(100vh-97px)] shadow-none p-0 mr-16 bg-gray-950 transition-all ">
        <StyleComponentLoader/>
          </div>
      )
    }
    </>
  );
};

export default EmailEditorSidebar;
