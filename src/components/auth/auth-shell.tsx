import Link from "next/link";

type AuthShellProps = {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
};

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-zinc-950 px-4 py-16 text-zinc-100">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-8 inline-block text-sm font-medium text-sky-400 hover:text-sky-300"
        >
          ← DoorBit AI
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? (
          <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>
        ) : null}
        {children != null ? <div className="mt-8">{children}</div> : null}
      </div>
    </div>
  );
}
