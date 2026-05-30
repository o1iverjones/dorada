import { Input } from "./input.js";
import { formatPhoneInput } from "../../lib/phone.js";

interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "type"> {
  value: string;
  onChange: (value: string) => void;
}

export function PhoneInput({ value, onChange, placeholder = "(XXX) XXX-XXXX", ...rest }: PhoneInputProps) {
  return (
    <Input
      type="tel"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(formatPhoneInput(e.target.value))}
      {...rest}
    />
  );
}
