import React from 'react';
import { Select, type SelectProps, type SelectOption } from './Select';
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';

interface FormSelectProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> extends Omit<SelectProps, 'value' | 'onChange'> {
  name: TName;
  control: Control<TFieldValues>;
  defaultValue?: string;
}

export function FormSelect<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  name,
  control,
  defaultValue,
  ...selectProps
}: FormSelectProps<TFieldValues, TName>) {
  const {
    field: { onChange, onBlur, value, ref },
    fieldState: { error }
  } = useController({
    name,
    control,
    defaultValue,
  });

  return (
    <Select
      {...selectProps}
      value={value}
      onChange={onChange}
      error={error?.message}
    />
  );
}