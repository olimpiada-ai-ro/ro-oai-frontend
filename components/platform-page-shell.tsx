import type { HTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { platformDisplay, platformSans } from '@/lib/platform-fonts';

type PlatformPageShellProps = HTMLAttributes<HTMLDivElement> & {
    contentClassName?: string;
};

export function PlatformPageShell({
    children,
    className,
    contentClassName,
    ...props
}: PlatformPageShellProps) {
    return (
        <div
            className={cn(
                'platform-page-shell',
                platformSans.variable,
                platformDisplay.variable,
                platformSans.className,
                className,
            )}
            {...props}
        >
            <div className={cn('platform-page-inner', contentClassName)}>{children}</div>
        </div>
    );
}

type PlatformPageHeaderProps = {
    title: ReactNode;
    description?: ReactNode;
    eyebrow?: ReactNode;
    icon?: LucideIcon;
    aside?: ReactNode;
    className?: string;
};

export function PlatformPageHeader({
    title,
    description,
    eyebrow,
    icon: Icon,
    aside,
    className,
}: PlatformPageHeaderProps) {
    return (
        <header className={cn('platform-page-header', className)}>
            <div className="min-w-0">
                {eyebrow && (
                    <p className="platform-page-eyebrow">
                        {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
                        <span>{eyebrow}</span>
                    </p>
                )}
                <h1 className="platform-page-title">{title}</h1>
                {description && <p className="platform-page-description">{description}</p>}
            </div>
            {aside && <div className="platform-page-aside">{aside}</div>}
        </header>
    );
}

type PlatformSectionHeadingProps = {
    title: ReactNode;
    titleId?: string;
    description?: ReactNode;
    eyebrow?: ReactNode;
    action?: ReactNode;
    className?: string;
};

export function PlatformSectionHeading({
    title,
    titleId,
    description,
    eyebrow,
    action,
    className,
}: PlatformSectionHeadingProps) {
    return (
        <div className={cn('platform-section-heading', className)}>
            <div className="min-w-0">
                {eyebrow && <p className="platform-section-eyebrow">{eyebrow}</p>}
                <h2 id={titleId} className="platform-section-title">
                    {title}
                </h2>
                {description && <p className="platform-section-description">{description}</p>}
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}

type PlatformEmptyStateProps = {
    title: ReactNode;
    description?: ReactNode;
    icon?: LucideIcon;
    action?: ReactNode;
    className?: string;
};

export function PlatformEmptyState({
    title,
    description,
    icon: Icon,
    action,
    className,
}: PlatformEmptyStateProps) {
    return (
        <div className={cn('platform-empty-state', className)}>
            {Icon && (
                <span className="platform-empty-icon">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
            )}
            <h2 className="text-lg font-semibold tracking-[-0.025em] text-[var(--platform-ink)]">
                {title}
            </h2>
            {description && (
                <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--platform-ink-muted)]">
                    {description}
                </p>
            )}
            {action && <div className="mt-5">{action}</div>}
        </div>
    );
}
