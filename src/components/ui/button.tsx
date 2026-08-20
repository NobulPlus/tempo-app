import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "ghost" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "btn-green-t",
  ghost: "btn-ghost-t",
  outline: "btn-outline-t",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "!px-5 !py-2.5 !text-[13.5px]",
  md: "!px-6 !py-3 !text-[14.5px]",
  lg: "", // uses the btn-*-t default padding/size from globals.css
};

interface BaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

type ButtonAsButton = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type ButtonAsLink = BaseProps & {
  href: string;
  target?: string;
  rel?: string;
};

export function Button(props: ButtonAsButton | ButtonAsLink) {
  const { variant = "primary", size = "lg", icon, className = "", children } = props;
  const cls = `btn-t ${VARIANT[variant]} ${SIZE[size]} ${className}`;

  if ("href" in props && props.href) {
    const { href, target, rel } = props;
    return (
      <Link href={href} target={target} rel={rel} className={cls}>
        {icon}
        {children}
      </Link>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to omit from `rest`
  const { icon: _icon, variant: _variant, size: _size, className: _className, href: _href, ...rest } =
    props as ButtonAsButton;
  return (
    <button className={cls} {...rest}>
      {icon}
      {children}
    </button>
  );
}
