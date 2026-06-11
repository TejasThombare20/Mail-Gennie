import { Label } from "src/components/ui-component/Label";
import { Switch } from "src/components/ui-component/Switch";



interface AdvancedToggleProps {
    id: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    label?: string;
  }

const AdvancedToggle = ({ 
    id, 
    checked, 
    onCheckedChange, 
    label = "Advanced" 
  } : AdvancedToggleProps) => {
    return (
      <div className="flex items-center justify-between py-2">
        <Label htmlFor={id} className="text-sm text-muted-foreground">{label}</Label>
        <Switch
          id={id} 
          checked={checked} 
          onCheckedChange={onCheckedChange} 
        />
      </div>
    );
  };

  export default AdvancedToggle;