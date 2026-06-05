import { formatPhone, telHref } from "../../lib/phone.js";

interface Props {
  phone: string | null | undefined;
  className?: string;
}

/**
 * Renders a phone number as a clickable tel: link (opens Grasshopper or the
 * system default phone handler). Falls back to plain text if the number can't
 * be normalised.
 */
export function PhoneLink({ phone, className }: Props) {
  const formatted = formatPhone(phone);
  const href = telHref(phone);

  if (!href || formatted === "—") {
    return <span className={className}>{formatted}</span>;
  }

  return (
    <a
      href={href}
      className={`text-primary hover:underline ${className ?? ""}`}
    >
      {formatted}
    </a>
  );
}
