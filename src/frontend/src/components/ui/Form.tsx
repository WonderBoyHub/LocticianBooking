import React from 'react';
import { useForm, type FieldValues, type UseFormReturn, type SubmitHandler, type DefaultValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { clsx } from 'clsx';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';

// Form Context
interface FormContextValue<TFieldValues extends FieldValues = FieldValues> {
  form: UseFormReturn<TFieldValues>;
}

const FormContext = React.createContext<FormContextValue | null>(null);

// Main Form Component
interface FormProps<TFieldValues extends FieldValues = FieldValues> {
  schema?: z.ZodTypeAny;
  onSubmit: SubmitHandler<TFieldValues>;
  defaultValues?: DefaultValues<TFieldValues>;
  className?: string;
  children: React.ReactNode;
  mode?: 'onChange' | 'onBlur' | 'onSubmit';
}

export function Form<TFieldValues extends FieldValues = FieldValues>({
  schema,
  onSubmit,
  defaultValues,
  className,
  children,
  mode = 'onBlur',
}: FormProps<TFieldValues>) {
  const form = useForm<TFieldValues>({
    resolver: schema ? zodResolver(schema as any) : undefined,
    defaultValues,
    mode,
  });

  return (
    <FormContext.Provider value={{ form }}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={clsx('space-y-6', className)}
        noValidate
      >
        {children}
      </form>
    </FormContext.Provider>
  );
}

// Form Field Component
interface FormFieldProps {
  name: string;
  label?: string;
  description?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  name,
  label,
  description,
  required,
  className,
  children
}) => {
  const context = React.useContext(FormContext);
  if (!context) {
    throw new Error('FormField must be used within a Form component');
  }

  const { form } = context;
  const error = form.formState.errors[name];

  return (
    <div className={clsx('space-y-2', className)}>
      {label && (
        <label
          htmlFor={name}
          className="block text-sm font-medium text-brand-dark"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {description && (
        <p className="text-sm text-brown-600">{description}</p>
      )}

      <div className="relative">
        {React.cloneElement(children as React.ReactElement, {
          id: name,
          ...form.register(name),
          'aria-invalid': !!error,
          'aria-describedby': error ? `${name}-error` : undefined
        })}
      </div>

      {error && (
        <div
          className="flex items-center space-x-2 text-red-600"
          id={`${name}-error`}
          role="alert"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{String(error.message ?? '')}</span>
        </div>
      )}
    </div>
  );
};

// Input Component
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  error,
  leftIcon,
  rightIcon,
  className,
  type = 'text',
  ...props
}) => {
  const [showPassword, setShowPassword] = React.useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;

  return (
    <div className="relative">
      {leftIcon && (
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <span className="text-brown-400">{leftIcon}</span>
        </div>
      )}

      <input
        type={inputType}
        className={clsx(
          'block w-full rounded-lg border-brown-300 shadow-sm transition-colors duration-200',
          'focus:border-brand-primary focus:ring-brand-primary focus:ring-2 focus:ring-opacity-20',
          'placeholder-brown-400 text-brand-dark',
          error && 'border-red-300 focus:border-red-500 focus:ring-red-500',
          leftIcon && 'pl-10',
          (rightIcon || isPassword) && 'pr-10',
          className
        )}
        {...props}
      />

      {(rightIcon || isPassword) && (
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
          {isPassword ? (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-brown-400 hover:text-brown-600 focus:outline-none focus:text-brown-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          ) : (
            <span className="text-brown-400">{rightIcon}</span>
          )}
        </div>
      )}
    </div>
  );
};

// Textarea Component
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
}

export const Textarea: React.FC<TextareaProps> = ({
  error,
  resize = 'vertical',
  className,
  ...props
}) => {
  return (
    <textarea
      className={clsx(
        'block w-full rounded-lg border-brown-300 shadow-sm transition-colors duration-200',
        'focus:border-brand-primary focus:ring-brand-primary focus:ring-2 focus:ring-opacity-20',
        'placeholder-brown-400 text-brand-dark',
        error && 'border-red-300 focus:border-red-500 focus:ring-red-500',
        resize === 'none' && 'resize-none',
        resize === 'vertical' && 'resize-y',
        resize === 'horizontal' && 'resize-x',
        resize === 'both' && 'resize',
        className
      )}
      {...props}
    />
  );
};

// Select Component
interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  placeholder?: string;
  error?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  options,
  placeholder,
  error,
  className,
  ...props
}) => {
  return (
    <select
      className={clsx(
        'block w-full rounded-lg border-brown-300 shadow-sm transition-colors duration-200',
        'focus:border-brand-primary focus:ring-brand-primary focus:ring-2 focus:ring-opacity-20',
        'text-brand-dark bg-white',
        error && 'border-red-300 focus:border-red-500 focus:ring-red-500',
        className
      )}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option
          key={option.value}
          value={option.value}
          disabled={option.disabled}
        >
          {option.label}
        </option>
      ))}
    </select>
  );
};

// Checkbox Component
interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  error?: boolean;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  description,
  error,
  className,
  ...props
}) => {
  return (
    <div className="flex items-start">
      <div className="flex items-center h-5">
        <input
          type="checkbox"
          className={clsx(
            'w-4 h-4 rounded border-brown-300 text-brand-primary shadow-sm',
            'focus:border-brand-primary focus:ring-brand-primary focus:ring-2 focus:ring-opacity-20',
            error && 'border-red-300 focus:border-red-500 focus:ring-red-500',
            className
          )}
          {...props}
        />
      </div>
      {(label || description) && (
        <div className="ml-3 text-sm">
          {label && (
            <label htmlFor={props.id} className="font-medium text-brand-dark">
              {label}
            </label>
          )}
          {description && (
            <p className="text-brown-600">{description}</p>
          )}
        </div>
      )}
    </div>
  );
};

// Radio Group Component
interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface RadioGroupProps {
  name: string;
  options: RadioOption[];
  value?: string;
  onChange?: (value: string) => void;
  error?: boolean;
  className?: string;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  name,
  options,
  value,
  onChange,
  error,
  className
}) => {
  return (
    <div className={clsx('space-y-3', className)}>
      {options.map((option) => (
        <div key={option.value} className="flex items-start">
          <div className="flex items-center h-5">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={(e) => onChange?.(e.target.value)}
              disabled={option.disabled}
              className={clsx(
                'w-4 h-4 border-brown-300 text-brand-primary shadow-sm',
                'focus:border-brand-primary focus:ring-brand-primary focus:ring-2 focus:ring-opacity-20',
                error && 'border-red-300 focus:border-red-500 focus:ring-red-500'
              )}
            />
          </div>
          <div className="ml-3 text-sm">
            <label className="font-medium text-brand-dark">
              {option.label}
            </label>
            {option.description && (
              <p className="text-brown-600">{option.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// Form Submit Button
interface FormSubmitProps {
  children: React.ReactNode;
  isLoading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  className?: string;
}

export const FormSubmit: React.FC<FormSubmitProps> = ({
  children,
  isLoading,
  disabled,
  variant = 'primary',
  className
}) => {
  const context = React.useContext(FormContext);
  if (!context) {
    throw new Error('FormSubmit must be used within a Form component');
  }

  const { form } = context;
  const isFormValid = form.formState.isValid;
  const isSubmitting = form.formState.isSubmitting;

  const isDisabled = disabled || isLoading || isSubmitting || !isFormValid;

  return (
    <motion.button
      type="submit"
      disabled={isDisabled}
      whileHover={{ scale: isDisabled ? 1 : 1.02 }}
      whileTap={{ scale: isDisabled ? 1 : 0.98 }}
      className={clsx(
        'inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        variant === 'primary' && [
          'bg-brand-primary text-white',
          'hover:bg-brand-dark focus:ring-brand-primary',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        ],
        variant === 'secondary' && [
          'bg-brand-secondary text-brand-dark',
          'hover:bg-brand-primary hover:text-white focus:ring-brand-secondary',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        ],
        className
      )}
    >
      {(isLoading || isSubmitting) && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full"
        />
      )}
      <span>{children}</span>
    </motion.button>
  );
};

// Form Error Summary
export const FormErrorSummary: React.FC = () => {
  const context = React.useContext(FormContext);
  if (!context) {
    throw new Error('FormErrorSummary must be used within a Form component');
  }

  const { form } = context;
  const errors = form.formState.errors;
  const errorList = Object.entries(errors);

  if (errorList.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-red-50 border border-red-200 rounded-lg p-4"
      role="alert"
    >
      <div className="flex">
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">
            Please correct the following errors:
          </h3>
          <ul className="mt-2 text-sm text-red-700 list-disc pl-5">
            {errorList.map(([field, error]) => (
              <li key={field}>
                {(error as any)?.message || `Invalid ${field}`}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
};
