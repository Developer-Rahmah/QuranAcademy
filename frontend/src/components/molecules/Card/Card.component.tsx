/**
 * Card Component
 * Container component with consistent styling
 */
import { cn } from '../../../lib/utils';
import { cardStyles } from './Card.style';
import type { CardProps, CardChildProps } from './Card.types';

/**
 * Card - Container component with consistent styling
 */
export function Card({
  variant = 'default',
  padding = 'md',
  children,
  className,
  onClick,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        cardStyles.base,
        cardStyles.variants[variant],
        cardStyles.padding[padding],
        onClick && cardStyles.interactive,
        className
      )}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * CardHeader - Header section of a card
 */
export function CardHeader({ children, className }: CardChildProps) {
  return (
    <div className={cn(cardStyles.header, className)}>
      {children}
    </div>
  );
}

/**
 * CardTitle - Title within a card
 */
export function CardTitle({ children, className }: CardChildProps) {
  return (
    <h3 className={cn(cardStyles.title, className)}>
      {children}
    </h3>
  );
}

/**
 * CardDescription - Description text within a card
 */
export function CardDescription({ children, className }: CardChildProps) {
  return (
    <p className={cn(cardStyles.description, className)}>
      {children}
    </p>
  );
}

/**
 * CardContent - Main content area of a card
 */
export function CardContent({ children, className }: CardChildProps) {
  return (
    <div className={cn(cardStyles.content, className)}>
      {children}
    </div>
  );
}

/**
 * CardFooter - Footer section of a card
 */
export function CardFooter({ children, className }: CardChildProps) {
  return (
    <div className={cn(cardStyles.footer, className)}>
      {children}
    </div>
  );
}

export default Card;
