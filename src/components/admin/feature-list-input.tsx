import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface FeatureListInputProps {
  features: string[];
  onChange: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  label: string;
  placeholder: (index: number) => string;
  addButtonText: string;
}

export function FeatureListInput({
  features,
  onChange,
  onAdd,
  onRemove,
  label,
  placeholder,
  addButtonText,
}: FeatureListInputProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">
        {label} <span className="text-destructive">*</span>
      </Label>
      <div className="space-y-2">
        {features.map((feature, index) => (
          <div key={index} className="flex gap-2">
            <Input
              value={feature}
              onChange={(e) => onChange(index, e.target.value)}
              placeholder={placeholder(index)}
              className="flex-1 h-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRemove(index)}
              disabled={features.length === 1}
              className="h-10 w-10 shrink-0"
              aria-label={`Remove feature ${index + 1}`}
            >
              ×
            </Button>
          </div>
        ))}
      </div>
      <Button 
        type="button" 
        variant="outline" 
        onClick={onAdd}
        className="w-full"
      >
        {addButtonText}
      </Button>
    </div>
  );
}
