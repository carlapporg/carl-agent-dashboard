"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";
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

const fieldLabelClass =
  "mb-2 block text-[16px] font-medium tracking-[-0.04em] text-muted";
const fieldInputClass =
  "h-[45px] rounded-[5px] border-border bg-surface px-[15px] text-[14px] tracking-[-0.05em] text-foreground placeholder:text-muted-dim";

function FieldLabel({
  field,
  htmlFor,
  showRequired,
  className,
}: {
  field: ConfirmationSchemaField;
  htmlFor: string;
  showRequired?: boolean;
  className?: string;
}) {
  return (
    <Label htmlFor={htmlFor} className={cn(fieldLabelClass, className)}>
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
    <div className="-mx-5 space-y-3">
      {items.map((item, index) => {
        const baseId = `${idPrefix}-${field.key}-${index}`;
        return (
          <div
            key={`${field.key}-${index}`}
            className="space-y-4 bg-surface-muted px-5 py-4 sm:rounded-[10px]"
          >
            <div className="flex items-center justify-between gap-2">
              <p className={fieldLabelClass}>
                {items.length > 1 ? `Item Name (${index + 1})` : "Item Name"}
                {field.required ? (
                  <span className="text-danger" aria-hidden>
                    {" "}
                    *
                  </span>
                ) : null}
              </p>
              {items.length > 1 ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-muted hover:text-danger disabled:opacity-50"
                  onClick={() => removeRow(index)}
                  disabled={disabled}
                >
                  Remove
                </button>
              ) : null}
            </div>
            <Input
              id={`${baseId}-name`}
              value={item.name}
              onChange={(event) =>
                updateRow(index, { name: event.target.value })
              }
              disabled={disabled}
              required={field.required}
              maxLength={200}
              placeholder="Item name"
              className={cn(fieldInputClass, "border-0 bg-surface")}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor={`${baseId}-qty`} className={fieldLabelClass}>
                  Quantity
                </Label>
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
                  className={cn(fieldInputClass, "border-0 bg-surface")}
                />
              </div>
              <div>
                <Label htmlFor={`${baseId}-price`} className={fieldLabelClass}>
                  Unit Price
                </Label>
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
                  placeholder="0.00"
                  className={cn(fieldInputClass, "border-0 bg-surface")}
                />
              </div>
            </div>
          </div>
        );
      })}
      <div className="px-5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([...items, emptyLineItem()])}
          className="inline-flex h-[43px] w-full items-center justify-center gap-2 rounded-[5px] bg-surface-muted text-[14px] font-medium tracking-[-0.05em] text-foreground transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add item
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/figma/task-detail/plus-02.svg"
            alt=""
            width={24}
            height={24}
            className="size-6 dark:invert"
          />
        </button>
      </div>
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
    <div className="space-y-5">
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
              <p className="mb-2 text-xs text-muted">
                From task details. Not sent on the confirmation draft.
              </p>
            ) : null}
            {isNotes ? (
              <Textarea
                id={id}
                className="min-h-24 rounded-[5px] border-border bg-surface text-foreground placeholder:text-muted-dim"
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
                placeholder={inputType === "money" ? "0.00" : field.label}
                className={fieldInputClass}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
