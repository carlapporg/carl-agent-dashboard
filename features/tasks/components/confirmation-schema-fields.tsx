"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  asFieldText,
  emptyLineItem,
  fieldInputType,
  isDraftConfirmationEditableField,
  isLineItemsValue,
  type ConfirmationFieldValue,
  type ConfirmationFormValues,
  type ConfirmationLineItemValue,
  type ConfirmationSchemaField,
} from "@/types/confirmation";

type ConfirmationSchemaFieldsProps = {
  fields: ConfirmationSchemaField[];
  values: ConfirmationFormValues;
  onChange: (key: string, value: ConfirmationFieldValue) => void;
  disabled?: boolean;
  idPrefix?: string;
};

function FieldLabel({
  field,
  htmlFor,
  showRequired,
}: {
  field: ConfirmationSchemaField;
  htmlFor: string;
  showRequired?: boolean;
}) {
  return (
    <Label htmlFor={htmlFor}>
      {field.label}
      {showRequired && field.required ? (
        <span className="text-danger" aria-hidden>
          {" "}
          *
        </span>
      ) : null}
    </Label>
  );
}

function LineItemsEditor({
  field,
  items,
  onChange,
  disabled,
  idPrefix,
}: {
  field: ConfirmationSchemaField;
  items: ConfirmationLineItemValue[];
  onChange: (items: ConfirmationLineItemValue[]) => void;
  disabled?: boolean;
  idPrefix: string;
}) {
  function updateRow(
    index: number,
    patch: Partial<ConfirmationLineItemValue>,
  ) {
    onChange(
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  }

  function removeRow(index: number) {
    if (items.length <= 1) {
      onChange([emptyLineItem()]);
      return;
    }
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className="space-y-3">
      <FieldLabel
        field={field}
        htmlFor={`${idPrefix}-${field.key}-0-name`}
        showRequired
      />
      <p className="text-xs text-muted">
        Each item needs a name, quantity, and unit price.
      </p>
      {items.map((item, index) => {
        const baseId = `${idPrefix}-${field.key}-${index}`;
        return (
          <div
            key={`${field.key}-${index}`}
            className="space-y-2 rounded-lg border border-border bg-surface-hover/40 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Item {index + 1}
              </p>
              <button
                type="button"
                className="text-xs font-semibold text-muted hover:text-danger disabled:opacity-50"
                onClick={() => removeRow(index)}
                disabled={disabled}
              >
                Remove
              </button>
            </div>
            <div>
              <Label htmlFor={`${baseId}-name`}>Name</Label>
              <Input
                id={`${baseId}-name`}
                value={item.name}
                onChange={(event) =>
                  updateRow(index, { name: event.target.value })
                }
                disabled={disabled}
                required={field.required}
                maxLength={200}
                placeholder="Zinger Burger"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label htmlFor={`${baseId}-qty`}>Quantity</Label>
                <Input
                  id={`${baseId}-qty`}
                  value={item.quantity}
                  onChange={(event) =>
                    updateRow(index, { quantity: event.target.value })
                  }
                  disabled={disabled}
                  required={field.required}
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="1"
                />
              </div>
              <div>
                <Label htmlFor={`${baseId}-price`}>Unit price</Label>
                <Input
                  id={`${baseId}-price`}
                  value={item.unitPrice}
                  onChange={(event) =>
                    updateRow(index, { unitPrice: event.target.value })
                  }
                  disabled={disabled}
                  required={field.required}
                  inputMode="decimal"
                  maxLength={40}
                  placeholder="8.49"
                />
              </div>
            </div>
          </div>
        );
      })}
      <Button
        type="button"
        variant="secondary"
        disabled={disabled}
        onClick={() => onChange([...items, emptyLineItem()])}
      >
        Add item
      </Button>
    </div>
  );
}

/** Schema-driven confirmation inputs — labels/keys/inputType come from Nest. */
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
        const inputType = fieldInputType(field);
        const value = values[field.key];
        const isNotes = field.key === "notes" || field.key === "details";
        const editable = isDraftConfirmationEditableField(field);
        const fieldDisabled = disabled || !editable;

        if (inputType === "lineItems") {
          const items = isLineItemsValue(value) ? value : [emptyLineItem()];
          return (
            <LineItemsEditor
              key={field.key}
              field={field}
              items={items}
              onChange={(next) => onChange(field.key, next)}
              disabled={fieldDisabled}
              idPrefix={idPrefix}
            />
          );
        }

        const text = asFieldText(value);

        return (
          <div key={field.key}>
            <FieldLabel
              field={field}
              htmlFor={id}
              showRequired={editable}
            />
            {!editable ? (
              <p className="mb-1 text-xs text-muted">
                From task details. Not sent on the confirmation draft.
              </p>
            ) : null}
            {isNotes ? (
              <Textarea
                id={id}
                className="min-h-24"
                value={text}
                onChange={(event) => onChange(field.key, event.target.value)}
                disabled={fieldDisabled}
                required={editable && field.required}
                maxLength={5000}
                readOnly={!editable}
              />
            ) : (
              <Input
                id={id}
                value={text}
                onChange={(event) => onChange(field.key, event.target.value)}
                disabled={fieldDisabled}
                required={editable && field.required}
                maxLength={500}
                readOnly={!editable}
                inputMode={inputType === "money" ? "decimal" : undefined}
                placeholder={inputType === "money" ? "0.00" : undefined}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
