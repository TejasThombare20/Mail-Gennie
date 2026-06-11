import { Label } from "src/components/ui-component/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "src/components/ui-component/Select";
import { FONT_FAMILIES, STYLE_PROPERTIES } from "src/lib/constants";
import { getStyleValueForSelectedElement } from "src/lib/utils";


interface OptionsPickerProps {
    value: string;
    onChange: (value: string) => void;
    options  : { label: string; value: string; }[]
    label   :string;
    placeHolder :string;

  }
  
const OptionsPicker = ({ value, onChange ,options , label ,placeHolder }: OptionsPickerProps) => {
    return (
      <div>
        <Label className="text-sm text-muted-foreground">{label}</Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder={placeHolder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option?.value} value={option?.value}>
                {option?.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };
  
  export default OptionsPicker;
  