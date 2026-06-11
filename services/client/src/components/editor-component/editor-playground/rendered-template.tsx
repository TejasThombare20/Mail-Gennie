import Recursive from "./recursive";
import { EditorElement } from "../../../providers/email-editor/editor-provider";

type Props = { state: any };

const RenderedTemplate = ({ state }: Props) => {
  return (
    <>
      {Array.isArray(state.editor.elements) &&
        state.editor.elements.map((childElement: EditorElement) => {
          return <Recursive key={childElement.id} element={childElement} />;
        })}
    </>
  );
};

export default RenderedTemplate;
