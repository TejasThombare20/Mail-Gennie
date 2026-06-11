import { useEffect, useRef } from "react";
import AdvancedToggle from "./AdvancedToggle";
import NumberInput from "./NumberInput";
import { Label } from "src/components/ui-component/Label";

interface SpacingControlProps {
    allSidesId: string;
    allSidesValue: number | string;
    topId: string;
    topValue: number | string;
    rightId: string;
    rightValue: number | string;
    bottomId: string;
    bottomValue: number | string;
    leftId: string;
    leftValue: number | string;
    onChange: (value : any) => void;
    label?: string;
    showAdvanced?: boolean;
    onAdvancedToggle?: (value: boolean) => void;
    unit?: string;
  }
  
const SpacingControl = ({
    allSidesId,
    allSidesValue,
    topId,
    topValue,
    rightId,
    rightValue,
    bottomId,
    bottomValue,
    leftId,
    leftValue,
    onChange,
    label,
    showAdvanced = false,
    onAdvancedToggle,
    unit = 'px'
  } : SpacingControlProps) => {

    const wasAdvanced = useRef(showAdvanced);

    useEffect(() => {
      if (!wasAdvanced.current && showAdvanced) {
        const newValue = allSidesValue || 0;
        onChange({ 
          target: { 
            value: {
              [topId]: newValue,
              [rightId]: newValue,
              [bottomId]: newValue,
              [leftId]: newValue
            }
          }
        });
      }
      wasAdvanced.current = showAdvanced;
    }, [showAdvanced ,allSidesValue]);



    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm text-muted-foreground">{label}</Label>
          <AdvancedToggle 
            id={`${allSidesId}Advanced`}
            checked={showAdvanced}
            onCheckedChange={onAdvancedToggle!}
            label="Individual sides"
          />
        </div>
        
        {!showAdvanced ? (
          <NumberInput
            id={allSidesId}
            value={allSidesValue }
            defaultValue={0}
            onChange={onChange}
            unit={unit}
            min={0}
            max={100}
          />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <NumberInput
              id={topId}
              value={topValue}
              defaultValue={0}
              onChange={onChange}
              label="Top"
              unit={unit}
              min={0}
              max={100}
            />
            <NumberInput
              id={rightId}
              value={rightValue}
              defaultValue={0}
              onChange={onChange}
              label="Right"
              unit={unit}
              min={0}
              max={100}
            />
            <NumberInput
              id={bottomId}
              value={bottomValue }
              defaultValue={0}
              onChange={onChange}
              label="Bottom"
              unit={unit}
              min={0}
              max={100}
            />
            <NumberInput
              id={leftId}
              value={leftValue}
              defaultValue={0}
              onChange={onChange}
              label="Left"
              unit={unit}
              min={0}
              max={100}
            />
          </div>
        )}
      </div>
    );
  };

  export default SpacingControl;