import ContextHelpLink from "@/components/help/context-help-link";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  helpHref?: string;
  actions?: React.ReactNode;
};

export default function PageHeader({
  title,
  subtitle,
  helpHref,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">{title}</h1>
          {helpHref && <ContextHelpLink href={helpHref} />}
        </div>
        {subtitle && (
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
