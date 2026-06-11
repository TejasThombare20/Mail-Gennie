import clsx from "clsx";
import { EyeOff } from "lucide-react";
import { useEffect, useRef } from "react";
import { useEditor } from "../../../providers/email-editor/editor-provider";
import { Button } from "../../ui-component/Button";
import RenderedTemplate from "./rendered-template";
import ReactDOMServer from "react-dom/server";

type Props = { liveMode?: boolean };

const EmailEditorGround = ({ liveMode }: Props) => {
  const { dispatch, state } = useEditor();

  useEffect(() => {
    if (liveMode) {
      dispatch({
        type: "TOGGLE_LIVE_MODE",
        payload: { value: true },
      });
    }
  }, [liveMode]);


  const editorRef = useRef<HTMLDivElement>(null);
  const handleClick = () => {
    dispatch({
      type: "CHANGE_CLICKED_ELEMENT",
      payload: {},
    });
  };

  const handleUnpreview = () => {
    dispatch({ type: "TOGGLE_PREVIEW_MODE" });
    dispatch({ type: "TOGGLE_LIVE_MODE" });
    const html = editorRef.current?.innerHTML;
    console.log("html", html)
  };



  const getHTML = () => {
    console.log("Hello")
    const html = editorRef.current?.innerHTML;
    console.log("html", html);
  };

  return (
    <div
      className={clsx(
        "use-automation-zoom-in h-full overflow-scroll mr-[385px] bg-white transition-all rounded-md ",
        {
          "!p-0 !mr-0":
            state.editor.previewMode === true || state.editor.liveMode === true,
          "!w-[850px]": state.editor.device === "Tablet",
          "!w-[420px]": state.editor.device === "Mobile",
          "w-full": state.editor.device === "Desktop",
        }
      )}
      onClick={handleClick}
    >
      {state.editor.previewMode && state.editor.liveMode && (
        <>
          <Button
            variant={"ghost"}
            size={"icon"}
            className="w-6 h-6 bg-slate-600 p-[2px] fixed top-0 left-0 z-[100]"
            onClick={handleUnpreview}
          >
            <EyeOff />
          </Button>

          <Button className="text-black" onClick={getHTML}>getHTML </Button>
        </>
      )}
      <div className="w-full h-full"  ref={editorRef} id="email-editor">
        {Array.isArray(state.editor.elements) && (
          <RenderedTemplate state={state} />
        )}
      </div>
    </div>
  );
};

export default EmailEditorGround;
