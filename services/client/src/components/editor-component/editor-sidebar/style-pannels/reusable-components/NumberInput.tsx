import { Minus, Plus } from "lucide-react";

import { useState } from "react";
import { Button } from "src/components/ui-component/Button";
import { Input } from "src/components/ui-component/Input";
import { Label } from "src/components/ui-component/Label";

// Numeric input with +/- buttons
interface NumberInputProps {
  id: string;
  value: number | string;
  onChange: (value: any) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  label?: string;
  className?: string;
  defaultValue?: number | string;
  allowDecimals?: boolean;
}

const NumberInput = ({
  id,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit = "px",
  label,
  className = "",
  defaultValue,
  allowDecimals = false,
}: NumberInputProps) => {
  // const numValue = typeof value === "number" ? value : parseInt(value,10) || 0;
  // const [rawValue, setRawValue] = useState(String(value ?? 0));
  const decimalPlaces = (num: number) =>
    (num.toString().split(".")[1] || "").length;

  const parseValue = (val: string) =>
    allowDecimals ? parseFloat(val) : parseInt(val, 10);
  const formatValue = (val: number) =>
    allowDecimals ? val.toFixed(decimalPlaces(step)) : String(Math.round(val));

  const numValue = typeof value === "number" ? value : parseValue(value) || 0;
  const [rawValue, setRawValue] = useState(formatValue(numValue));
  const [enteredDecimal, setEnteredDecimal] = useState(rawValue.includes('.'));


  // const handleIncrement = () => {
  //   if (numValue < max) {
  //     setRawValue((prev) => String(parseInt(prev || '0', 10) + step));
  //     onChange({
  //       target: {
  //         id,
  //         value: numValue + step,
  //       },
  //     });
  //   }
  // };

  // const handleDecrement = () => {
  //   console.log("numValue", numValue)
  //   if (numValue > min) {
  //     setRawValue((prev) => String(parseInt(prev || '0', 10) - step));
  //     onChange({
  //       target: {
  //         id,
  //         value: numValue - step,
  //       },
  //     });
  //   }
  // };

  // const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const val = e.target.value;

  //   // Allow empty input while typing
  //   if (val === '') {
  //     setRawValue('');
  //     onChange({ target: { id, value: 0 } });
  //     return;
  //   }

  //   // Only allow digits
  //   if (!/^\d+$/.test(val)) return;

  //   const numeric = parseInt(val, 10);
  //   const clamped = Math.min(Math.max(numeric, min), max);
  //   setRawValue(String(clamped));

  //   onChange({
  //     target: {
  //       id,
  //       value: clamped,
  //     },
  //   });
  // };

  const handleIncrement = () => {
    if (numValue < max) {
      const newValue = Math.min(numValue + step, max);
      setRawValue(formatValue(newValue));
      onChange({ target: { id, value: parseValue(formatValue(newValue)) } });
    }
  };

  const handleDecrement = () => {
    if (numValue > min) {
      const newValue = Math.max(numValue - step, min);
      setRawValue(formatValue(newValue));
      onChange({ target: { id, value: parseValue(formatValue(newValue)) } });
    }
  };

  const handleBlur = () => {
    // Check if the value has no decimal, and add it if necessary
    let finalValue = rawValue;

    if (allowDecimals && !finalValue.includes('.')) {
      finalValue = finalValue + '.';
    }

    const cleaned = formatValue(parseValue(finalValue));
    setRawValue(cleaned);
    onChange({ target: { id, value: parseValue(cleaned) } });
  };

  // const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   let val = e.target.value;


  //   // Allow empty input while typing
  //   if (val === "") {
  //     setRawValue("");
  //     onChange({ target: { id, value: allowDecimals ? 0.0 : 0 } });
  //     return;
  //   }

  //   // Regex validation: Allow decimals if `allowDecimals` is true
  //   const regex = allowDecimals ? /^\d*\.?\d*$/ : /^\d+$/;
  //   if (!regex.test(val)) return;

  //   const numeric = parseValue(val);
  //   if (!isNaN(numeric)) {
  //     const clamped = Math.min(Math.max(numeric, min), max);
  //     setRawValue(formatValue(clamped));
  //     onChange({ target: { id, value: clamped } });
  //   }
  // };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;

    // If value is empty, reset and return
    if (val === '') {
      setRawValue('');
      onChange({ target: { id, value: allowDecimals ? 0.0 : 0 } });
      setEnteredDecimal(false); // Reset decimal state when cleared
      return;
    }

    // Handle the case where decimal point is deleted
    if (val.indexOf('.') === -1) {
      setEnteredDecimal(false);
    } else {
      setEnteredDecimal(true);
    }

    // Only allow digits and decimal point if decimals are allowed
    const regex = allowDecimals ? /^\d*\.?\d*$/ : /^\d+$/;
    if (!regex.test(val)) return;

    // If no decimal point exists, automatically add it when typing continues
    // if (allowDecimals && !enteredDecimal && !val.includes('.')) {
    //   val = val + '.0';
    //   setEnteredDecimal(true); // Mark that a decimal point is now in the value
    // }

    // Parse the value and clamp between min and max
    let numeric = parseValue(val);
    if (numeric < min) numeric = min;
    if (numeric > max) numeric = max;

    // Update the raw value and call onChange
    setRawValue(val);
    onChange({ target: { id, value: numeric } });
  };


  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <Label htmlFor={id} className="text-sm text-muted-foreground">
          {label}
        </Label>
      )}
      <div className="flex items-center">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-r-none"
          onClick={handleDecrement}
        >
          <Minus className="h-3 w-3" />
        </Button>
        {/* <Input
          id={id}
          defaultValue={defaultValue }
          type="text" // change to text
          inputMode="numeric" // mobile-friendly numeric keyboard
          pattern="\d*" // only digits
          value={rawValue}
          onBlur={handleBlur}
          onChange={handleInputChange}
          min={min}
          max={max}
          step={step}
          className="h-8 w-16 rounded-none text-center 
             focus:outline-none focus:ring-0 focus:border-none 
             appearance-none 
              focus:border-transparent
              focus-visible:ring-0 focus-visible:ring-transparent
             [&::-webkit-inner-spin-button]:appearance-none 
             [&::-webkit-outer-spin-button]:appearance-none 
             [&::-webkit-inner-spin-button]:m-0 
             [&::-webkit-outer-spin-button]:m-0
             "
        /> */}
        <Input
          id={id}
          defaultValue={defaultValue}
          type="text"
          inputMode={allowDecimals ? "decimal" : "numeric"}
          pattern={allowDecimals ? "\\d*\\.?\\d*" : "\\d+"}
          value={rawValue}
          onBlur={handleBlur}
          onChange={handleInputChange}
          min={min}
          max={max}
          step={step}
          className="h-8 w-16 rounded-none text-center 
         focus:outline-none focus:ring-0 focus:border-none 
         appearance-none 
          focus:border-transparent
          focus-visible:ring-0 focus-visible:ring-transparent
         [&::-webkit-inner-spin-button]:appearance-none 
         [&::-webkit-outer-spin-button]:appearance-none 
         [&::-webkit-inner-spin-button]:m-0 
         [&::-webkit-outer-spin-button]:m-0"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-l-none"
          onClick={handleIncrement}
        >
          <Plus className="h-3 w-3" />
        </Button>
        {unit && (
          <span className="ml-2 text-sm text-muted-foreground">{unit}</span>
        )}
      </div>
    </div>
  );
};

export default NumberInput;
