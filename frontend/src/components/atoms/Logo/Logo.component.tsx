/**
 * Logo — official Wahdaynak Academy logo.
 *
 * Sourced from `/wahdaynakacademylogo.png` in `public/`. Kept as a tiny atom
 * so size/framing stays consistent across landing, auth, and dashboard
 * surfaces. Alt text pulls from i18n so screen readers get a translated
 * description.
 */
import { useTranslation } from "../../../locales/i18n";

export type LogoSize = "sm" | "md" | "lg" | "xl";

interface LogoProps {
  size?: LogoSize;
  className?: string;
}

const SIZE_CLS: Record<LogoSize, string> = {
  sm: "w-10 h-10",
  md: "w-16 h-16",
  lg: "w-24 h-24",
  xl: "w-32 h-32",
};

export function Logo({ size = "md", className = "" }: LogoProps) {
  const { t } = useTranslation();
  return (
    <img
      src="/wahdaynakacademylogo.png"
      alt={t("landing.logoAlt")}
      className={`${SIZE_CLS[size]} object-contain rounded-xl ${className}`}
      draggable={false}
    />
  );
}

export default Logo;
