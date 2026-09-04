"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ConfirmationSchemaField } from "@/types/confirmation";

type ConfirmationSchemaFieldsProps = {
  fields: ConfirmationSchemaField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
  idPrefix?: string;
};

/** Schema-driven confirmation inputs — labels/keys come from Nest only. */
export function ConfirmationSchemaFields({
  fields,
  values,
  onChange,
  disabled = false,
  idPrefix = "confirm-field",
}: ConfirmationSchemaFieldsProps) {
  if (fields.length === 0) return null;

  return (
    <div className="space-y-3">
      {fields.map((field) => {
        const id = `${idPrefix}-${field.key}`;
        const value = values[field.key] ?? "";
        const isNotes = field.key === "notes" || field.key === "details";

        return (
          <div key={field.key}>
            <Label htmlFor={id}>
              {field.label}
              {field.required ? (
                <span className="text-danger" aria-hidden>
                  {" "}
                  *
                </span>
              ) : null}
            </Label>
            {isNotes ? (
              <Textarea
                id={id}
                className="min-h-24"
                value={value}
                onChange={(event) => onChange(field.key, event.target.value)}
                disabled={disabled}
                required={field.required}
                maxLength={5000}
              />
            ) : (
              <Input
                id={id}
                value={value}
                onChange={(event) => onChange(field.key, event.target.value)}
                disabled={disabled}
                required={field.required}
                maxLength={500}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
