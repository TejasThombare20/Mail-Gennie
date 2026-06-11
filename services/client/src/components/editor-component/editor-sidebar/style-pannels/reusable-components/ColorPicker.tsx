import { ChangeEvent } from "react";
import { Button } from "src/components/ui-component/Button";
import { Label } from "src/components/ui-component/Label";
import { Input } from "src/components/ui-component/Input";
import { Popover, PopoverContent, PopoverTrigger } from "src/components/ui-component/Popover";


interface ColorPickerProps {
  id: string;
  value: string;
  onChange: (color: ChangeEvent<HTMLInputElement>) => void;
  label?: string;
}
const ColorPicker = ({ 
    id, 
    value, 
    onChange, 
    label 
  } : ColorPickerProps) => {
    return (
      <div className="flex flex-col gap-1">
        {label && <Label htmlFor={id} className="text-sm text-muted-foreground">{label}</Label>}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline" 
              className="flex items-center justify-between w-full px-3 h-9"
            >
              <div className="flex items-center gap-2">
                <div 
                  className="w-5 h-5 rounded-sm border"
                  style={{ backgroundColor: value || '#000000' }}
                />
                <span>{value || '#000000'}</span>
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3">
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Input
                  id={id}
                  type="color"
                  onChange={onChange}
                  value={value || '#000000'}
                  className="w-10 h-10 p-1"
                />
                <Input
                  id={id}
                  placeholder="#000000"
                  onChange={onChange}
                  value={value || ''}
                  className="w-32"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  };

  export default ColorPicker;