import { BadgeCheck, UserRound } from 'lucide-react';

import { UserAvatar } from '@/components/user-avatar';
import { UserIdentityPresentation } from '@/components/user-identity-presentation';
import { Link } from '@/i18n/routing';
import { getArticleAuthorName, type ArticleAuthor } from '@/lib/articles';
import { getProfileUrl } from '@/lib/profile-utils';
import { cn } from '@/lib/utils';

type ArticleAuthorsProps = {
    authors: ArticleAuthor[];
    label: string;
    compact?: boolean;
    className?: string;
    fallbackName?: string;
    problemAuthorLabel?: string;
};

export function ArticleAuthors({
    authors,
    label,
    compact = false,
    className,
    fallbackName,
    problemAuthorLabel,
}: ArticleAuthorsProps) {
    if (authors.length === 0) return null;

    if (compact) {
        return (
            <p
                className={cn(
                    'flex min-w-0 items-center gap-2 text-sm text-[var(--platform-ink-muted)]',
                    className,
                )}
            >
                <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="shrink-0">{label}</span>
                <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 font-semibold text-[var(--platform-ink)]">
                    {authors.map((author, index) => (
                        <span
                            key={author.userId}
                            className="inline-flex min-w-0 items-center gap-1.5"
                        >
                            {index > 0 ? <span aria-hidden="true">,</span> : null}
                            <UserIdentityPresentation
                                surface="AUTHOR"
                                compact
                                identityPresentation={author.identityPresentation}
                                username={getArticleAuthorName(author, fallbackName)}
                            />
                        </span>
                    ))}
                </span>
            </p>
        );
    }

    return (
        <div className={cn('flex flex-wrap items-center gap-3', className)}>
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--platform-ink-muted)]">
                {label}
            </span>
            <ol className="flex flex-wrap gap-2">
                {authors.map((author) => {
                    const name = getArticleAuthorName(author, fallbackName);
                    return (
                        <li key={author.userId}>
                            <Link
                                href={getProfileUrl(author.userId, author.username)}
                                className="group inline-flex min-h-11 items-center gap-2 border border-[var(--platform-line-strong)] bg-[var(--platform-paper)] pe-3 ps-1.5 text-sm font-semibold text-[var(--platform-ink)] transition-colors hover:border-[var(--platform-violet)] hover:bg-[var(--platform-paper-strong)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--platform-coral)]"
                            >
                                <UserAvatar
                                    avatar={author.avatar}
                                    userId={author.userId}
                                    username={author.username}
                                    displayName={name}
                                    className="h-8 w-8 rounded-none border border-[var(--platform-line)] bg-[var(--platform-paper-strong)] [&>*]:rounded-none"
                                    imageClassName="rounded-none"
                                    fallbackClassName="rounded-none text-xs"
                                    loading="lazy"
                                />
                                <span className="flex min-w-0 flex-col items-start py-1">
                                    <UserIdentityPresentation
                                        surface="AUTHOR"
                                        layout="stacked"
                                        compact
                                        identityPresentation={author.identityPresentation}
                                        username={name}
                                        usernameClassName="group-hover:opacity-80"
                                    />
                                    {author.isProblemAuthor && problemAuthorLabel ? (
                                        <span className="mt-0.5 inline-flex items-center gap-1 bg-[var(--platform-citron)] px-1.5 py-0.5 text-[0.68rem] font-bold leading-4 text-[var(--platform-on-accent)]">
                                            <BadgeCheck
                                                className="h-3.5 w-3.5"
                                                aria-hidden="true"
                                            />
                                            {problemAuthorLabel}
                                        </span>
                                    ) : null}
                                </span>
                            </Link>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
