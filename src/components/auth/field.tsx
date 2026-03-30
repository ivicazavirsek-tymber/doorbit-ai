type FieldProps = {
  label: string;
  id: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
};

export function Field({
  label,
  id,
  type = "text",
  autoComplete,
  required,
  value,
  onChange,
  disabled,
}: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-zinc-300">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        required={required}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none ring-sky-500/40 placeholder:text-zinc-500 focus:border-sky-500 focus:ring-2 disabled:opacity-50"
      />
    </div>
  );
}
