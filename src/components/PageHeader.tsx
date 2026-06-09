import Image from "next/image";

interface PageHeaderProps {
  title: string;
  description?: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="wc-page-header mb-8">
      <p className="wc-kicker">FIFA World Cup 2026</p>
      <h1 className="font-fifa wc-page-title">{title}</h1>
      {description && <p className="wc-page-desc">{description}</p>}
    </div>
  );
}

export function BrandMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "h-10 w-10",
    md: "h-14 w-14",
    lg: "h-20 w-20",
  };

  return (
    <div className={`${sizes[size]} relative shrink-0 overflow-hidden rounded-2xl shadow-lg ring-2 ring-white/20`}>
      <Image
        src="/images/wc2026-logo.png"
        alt="FIFA World Cup 2026"
        fill
        className="object-cover"
        priority
      />
    </div>
  );
}
