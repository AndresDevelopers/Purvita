import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PaymentFormFieldProps {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  type?: 'text' | 'password';
  statusText?: string;
  hintText?: string;
}

export const PaymentFormField = ({
  id,
  label,
  placeholder,
  value,
  onChange,
  disabled = false,
  type = 'text',
  statusText,
  hintText,
}: PaymentFormFieldProps) => {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        inputMode={type === 'password' ? undefined : 'text'}
        autoComplete="off"
      />
      {statusText && (
        <p className="text-xs text-muted-foreground">{statusText}</p>
      )}
      {hintText && (
        <p className="text-xs text-muted-foreground">{hintText}</p>
      )}
    </div>
  );
};