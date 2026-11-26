import type { ReactNode } from 'react';

import { getUserAvatarTone, getUserInitials, type UserAvatarTone } from '@/lib/user-identity';

import { OG_FRAME, OG_GRID_BACKGROUND, OG_THEME } from './theme';
import {
    formatOgDate,
    formatOgMetric,
    getCountryFlagEmoji,
    getRenderableOgText,
    normalizeOgText,
} from './text';

export type PlatformOgKind =
    | 'generic'
    | 'problems'
    | 'competitions'
    | 'articles'
    | 'leaderboard'
    | 'institutions'
    | 'countries'
    | 'roadmap'
    | 'achievements'
    | 'legal';

export type ProblemDifficulty = 'Easy' | 'Medium' | 'Hard';
export type CompetitionStatus = 'UPCOMING' | 'ACTIVE' | 'ENDED';
export type ArticleOgKind = 'ARTICLE' | 'PROBLEM_EDITORIAL';

const PROFILE_AVATAR_TONES: Record<UserAvatarTone, { backgroundColor: string; color: string }> = {
    violet: { backgroundColor: '#ece7ff', color: '#5418b8' },
    coral: { backgroundColor: '#ffe6df', color: '#9d351f' },
    citron: { backgroundColor: '#eff7c9', color: '#465600' },
    sky: { backgroundColor: '#e2f3ff', color: '#175f8e' },
    teal: { backgroundColor: '#ddf4eb', color: '#146047' },
    rose: { backgroundColor: '#fce5ee', color: '#8b2853' },
};

const KIND_REGISTER: Record<
    PlatformOgKind,
    { eyebrow: string; code: string; mark: string; register: string }
> = {
    generic: {
        eyebrow: 'MLCompete',
        code: 'MLC / 01',
        mark: 'ML',
        register: 'Learn · Build · Compete',
    },
    problems: {
        eyebrow: 'Problem library',
        code: 'P / INDEX',
        mark: '{ }',
        register: 'Train · Validate · Submit',
    },
    competitions: {
        eyebrow: 'Competition arena',
        code: 'C / EVENTS',
        mark: '01',
        register: 'Challenge accepted',
    },
    articles: {
        eyebrow: 'Community knowledge',
        code: 'A / READ',
        mark: 'Aa',
        register: 'Ideas worth sharing',
    },
    leaderboard: {
        eyebrow: 'Global rankings',
        code: 'R / LIVE',
        mark: '#1',
        register: 'Competitors · Institutions',
    },
    institutions: {
        eyebrow: 'Education directory',
        code: 'EDU / INDEX',
        mark: 'EDU',
        register: 'Schools · Communities',
    },
    countries: {
        eyebrow: 'Global community',
        code: 'WORLD / INDEX',
        mark: '🌍',
        register: 'Countries · Institutions',
    },
    roadmap: {
        eyebrow: 'Platform roadmap',
        code: 'NEXT / MLC',
        mark: '→',
        register: 'Building what comes next',
    },
    achievements: {
        eyebrow: 'Learning milestones',
        code: 'XP / PROGRESS',
        mark: 'XP',
        register: 'Solve · Compete · Grow',
    },
    legal: {
        eyebrow: 'MLCompete · Legal',
        code: 'DOC / MLC',
        mark: '§',
        register: 'Clear rules · Safe platform',
    },
};

function getTitleFontSize(title: string, hasSubtitle: boolean): string {
    const length = Array.from(title).length;
    if (length > 62) return hasSubtitle ? '46px' : '50px';
    if (length > 44) return hasSubtitle ? '50px' : '56px';
    if (length > 28) return hasSubtitle ? '56px' : '64px';
    return hasSubtitle ? '62px' : '74px';
}

function NotebookOgShell({
    eyebrow,
    title,
    subtitle,
    bottomLine,
    logoUrl,
    panelBackground = OG_THEME.violet,
    panelForeground = OG_THEME.paper,
    visual,
}: {
    eyebrow: string;
    title: string;
    subtitle?: string;
    bottomLine: string;
    logoUrl: string;
    panelBackground?: string;
    panelForeground?: string;
    visual: ReactNode;
}) {
    const renderedEyebrow = getRenderableOgText(eyebrow, 42, 'MLCompete');
    const renderedTitle = getRenderableOgText(title, 72, 'MLCompete');
    const renderedSubtitle = subtitle
        ? getRenderableOgText(subtitle, 116, 'Machine learning competitions')
        : undefined;
    const renderedBottomLine = getRenderableOgText(bottomLine, 70, 'platform.olimpiada-ai.ro');

    return (
        <div
            style={{
                position: 'relative',
                height: '100%',
                width: '100%',
                display: 'flex',
                overflow: 'hidden',
                backgroundColor: OG_THEME.paper,
                backgroundImage: OG_GRID_BACKGROUND,
                backgroundSize: '32px 32px',
                color: OG_THEME.ink,
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '14px',
                    display: 'flex',
                    backgroundColor: OG_THEME.citron,
                }}
            />

            <div
                style={{
                    width: `${OG_FRAME.leftColumnWidth}px`,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '66px 40px 58px 72px',
                }}
            >
                <img
                    alt=""
                    src={logoUrl}
                    width={238}
                    height={55}
                    style={{ objectFit: 'contain' }}
                />

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginTop: renderedSubtitle ? '60px' : '78px',
                        color: OG_THEME.inkSoft,
                        fontSize: '21px',
                        fontWeight: 800,
                        letterSpacing: '3.6px',
                        textTransform: 'uppercase',
                    }}
                >
                    <span
                        style={{
                            width: '15px',
                            height: '15px',
                            display: 'flex',
                            flexShrink: 0,
                            marginRight: '15px',
                            backgroundColor: OG_THEME.coral,
                        }}
                    />
                    {renderedEyebrow}
                </div>

                <div
                    style={{
                        maxWidth: '620px',
                        display: 'flex',
                        marginTop: '20px',
                        color: OG_THEME.ink,
                        fontSize: getTitleFontSize(renderedTitle, Boolean(renderedSubtitle)),
                        fontWeight: 900,
                        letterSpacing: '-2.8px',
                        lineHeight: 1.04,
                    }}
                >
                    {renderedTitle}
                </div>

                {renderedSubtitle ? (
                    <div
                        style={{
                            maxWidth: '610px',
                            display: 'flex',
                            marginTop: '18px',
                            color: OG_THEME.inkMuted,
                            fontSize: '22px',
                            fontWeight: 600,
                            lineHeight: 1.32,
                        }}
                    >
                        {renderedSubtitle}
                    </div>
                ) : null}

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginTop: 'auto',
                        color: OG_THEME.inkMuted,
                        fontSize: '21px',
                        fontWeight: 700,
                    }}
                >
                    {renderedBottomLine}
                    <span
                        style={{
                            width: '54px',
                            height: '3px',
                            display: 'flex',
                            flexShrink: 0,
                            marginLeft: '18px',
                            backgroundColor: OG_THEME.violet,
                        }}
                    />
                </div>
            </div>

            <div
                style={{
                    position: 'absolute',
                    top: '112px',
                    right: '50px',
                    width: `${OG_FRAME.panelWidth}px`,
                    height: `${OG_FRAME.panelHeight}px`,
                    display: 'flex',
                    backgroundColor: OG_THEME.citron,
                }}
            />
            <div
                style={{
                    position: 'absolute',
                    top: '92px',
                    right: '72px',
                    width: `${OG_FRAME.panelWidth}px`,
                    height: `${OG_FRAME.panelHeight}px`,
                    display: 'flex',
                    overflow: 'hidden',
                    backgroundColor: panelBackground,
                    border: `3px solid ${OG_THEME.ink}`,
                    color: panelForeground,
                }}
            >
                {visual}
            </div>

            <div
                style={{
                    position: 'absolute',
                    right: '72px',
                    bottom: '56px',
                    display: 'flex',
                    color: OG_THEME.inkSoft,
                    fontSize: '18px',
                    fontWeight: 700,
                    letterSpacing: '1px',
                }}
            >
                platform.olimpiada-ai.ro
            </div>
        </div>
    );
}

function CornerMarker() {
    return (
        <div
            style={{
                position: 'absolute',
                top: '22px',
                right: '22px',
                width: '22px',
                height: '22px',
                display: 'flex',
                backgroundColor: OG_THEME.coral,
            }}
        />
    );
}

function RegisterVisual({
    code,
    mark,
    register,
    countryCode,
}: {
    code: string;
    mark: string;
    register: string;
    countryCode?: string | null;
}) {
    const flagEmoji = countryCode ? getCountryFlagEmoji(countryCode) : null;
    const markFontSize = Array.from(mark).length > 3 ? '82px' : '112px';

    return (
        <div
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                padding: '30px 30px 26px',
            }}
        >
            <CornerMarker />
            <div
                style={{
                    display: 'flex',
                    color: OG_THEME.paperStrong,
                    fontSize: '16px',
                    fontWeight: 900,
                    letterSpacing: '2.4px',
                }}
            >
                {code}
            </div>
            <div
                style={{
                    display: 'flex',
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: OG_THEME.paper,
                    fontSize: flagEmoji ? '106px' : markFontSize,
                    fontWeight: 900,
                    letterSpacing: mark === 'EDU' ? '-6px' : '-4px',
                    lineHeight: 1,
                }}
            >
                {flagEmoji || mark}
            </div>
            {flagEmoji ? (
                <div
                    style={{
                        position: 'absolute',
                        top: '132px',
                        right: '34px',
                        display: 'flex',
                        backgroundColor: OG_THEME.citron,
                        border: `2px solid ${OG_THEME.ink}`,
                        color: OG_THEME.ink,
                        fontSize: '20px',
                        fontWeight: 900,
                        letterSpacing: '5px',
                        padding: '8px 11px 8px 16px',
                    }}
                >
                    {countryCode}
                </div>
            ) : null}
            <div
                style={{
                    minHeight: '72px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: OG_THEME.citron,
                    border: `3px solid ${OG_THEME.ink}`,
                    color: OG_THEME.ink,
                    fontSize: '17px',
                    fontWeight: 900,
                    letterSpacing: '1.4px',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    padding: '12px 18px',
                }}
            >
                {register}
            </div>
        </div>
    );
}

function ProblemVisual({
    difficulty,
    problemId,
}: {
    difficulty: ProblemDifficulty;
    problemId?: number;
}) {
    const difficultyBackground =
        difficulty === 'Easy'
            ? OG_THEME.citron
            : difficulty === 'Medium'
              ? OG_THEME.coral
              : OG_THEME.paper;

    return (
        <div
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                padding: '30px 30px 26px',
            }}
        >
            <CornerMarker />
            <div
                style={{
                    display: 'flex',
                    color: OG_THEME.paperStrong,
                    fontSize: '16px',
                    fontWeight: 900,
                    letterSpacing: '2.4px',
                }}
            >
                PROBLEM {problemId ? `· #${problemId}` : '· ML'}
            </div>
            <div
                style={{
                    display: 'flex',
                    flex: 1,
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <svg width="268" height="142" viewBox="0 0 268 162">
                    <path
                        d="M19 139 C68 139, 64 91, 112 91 C161 91, 154 39, 245 39"
                        fill="none"
                        stroke={OG_THEME.citron}
                        strokeWidth="8"
                    />
                    <path
                        d="M19 151 L245 151"
                        fill="none"
                        stroke={OG_THEME.paperStrong}
                        strokeWidth="3"
                    />
                    <circle
                        cx="19"
                        cy="139"
                        r="11"
                        fill={OG_THEME.coral}
                        stroke={OG_THEME.ink}
                        strokeWidth="3"
                    />
                    <circle
                        cx="112"
                        cy="91"
                        r="11"
                        fill={OG_THEME.paper}
                        stroke={OG_THEME.ink}
                        strokeWidth="3"
                    />
                    <circle
                        cx="245"
                        cy="39"
                        r="11"
                        fill={OG_THEME.citron}
                        stroke={OG_THEME.ink}
                        strokeWidth="3"
                    />
                </svg>
                <div
                    style={{
                        width: '268px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: '4px',
                        color: OG_THEME.paperStrong,
                        fontSize: '12px',
                        fontWeight: 900,
                        letterSpacing: '1.2px',
                    }}
                >
                    <span style={{ display: 'flex' }}>DATA</span>
                    <span style={{ display: 'flex' }}>MODEL</span>
                    <span style={{ display: 'flex' }}>SCORE</span>
                </div>
            </div>
            <div
                style={{
                    height: '72px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: difficultyBackground,
                    border: `3px solid ${OG_THEME.ink}`,
                    color: OG_THEME.ink,
                    padding: '0 20px',
                }}
            >
                <span
                    style={{
                        display: 'flex',
                        fontSize: '14px',
                        fontWeight: 900,
                        letterSpacing: '2px',
                    }}
                >
                    DIFFICULTY
                </span>
                <span style={{ display: 'flex', fontSize: '27px', fontWeight: 900 }}>
                    {difficulty}
                </span>
            </div>
        </div>
    );
}

function CompetitionVisual({
    status,
    startDate,
    endDate,
}: {
    status: CompetitionStatus;
    startDate: string;
    endDate: string;
}) {
    const statusLabel =
        status === 'UPCOMING' ? 'Upcoming' : status === 'ACTIVE' ? 'Live now' : 'Completed';
    const statusBackground =
        status === 'UPCOMING'
            ? OG_THEME.citron
            : status === 'ACTIVE'
              ? OG_THEME.coral
              : OG_THEME.paper;

    return (
        <div
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                padding: '30px 30px 26px',
            }}
        >
            <CornerMarker />
            <div
                style={{
                    display: 'flex',
                    color: OG_THEME.paperStrong,
                    fontSize: '16px',
                    fontWeight: 900,
                    letterSpacing: '2.4px',
                }}
            >
                COMPETITION · MLC
            </div>
            <div
                style={{
                    display: 'flex',
                    flex: 1,
                    flexDirection: 'column',
                    justifyContent: 'center',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        color: OG_THEME.paper,
                        fontSize: '14px',
                        fontWeight: 900,
                        letterSpacing: '1.5px',
                    }}
                >
                    <span style={{ display: 'flex' }}>START</span>
                    <span style={{ display: 'flex' }}>FINISH</span>
                </div>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginTop: '12px',
                    }}
                >
                    <span
                        style={{
                            width: '20px',
                            height: '20px',
                            display: 'flex',
                            backgroundColor: OG_THEME.coral,
                            border: `3px solid ${OG_THEME.ink}`,
                        }}
                    />
                    <span
                        style={{
                            height: '5px',
                            display: 'flex',
                            flex: 1,
                            backgroundColor: OG_THEME.citron,
                        }}
                    />
                    <span
                        style={{
                            width: '20px',
                            height: '20px',
                            display: 'flex',
                            backgroundColor: OG_THEME.paper,
                            border: `3px solid ${OG_THEME.ink}`,
                        }}
                    />
                </div>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: '14px',
                        color: OG_THEME.paperStrong,
                        fontSize: '15px',
                        fontWeight: 700,
                    }}
                >
                    <span style={{ display: 'flex' }}>{formatOgDate(startDate)}</span>
                    <span style={{ display: 'flex' }}>{formatOgDate(endDate)}</span>
                </div>
            </div>
            <div
                style={{
                    height: '72px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: statusBackground,
                    border: `3px solid ${OG_THEME.ink}`,
                    color: OG_THEME.ink,
                    padding: '0 20px',
                }}
            >
                <span
                    style={{
                        display: 'flex',
                        fontSize: '14px',
                        fontWeight: 900,
                        letterSpacing: '2px',
                    }}
                >
                    STATUS
                </span>
                <span style={{ display: 'flex', fontSize: '25px', fontWeight: 900 }}>
                    {statusLabel}
                </span>
            </div>
        </div>
    );
}

function ArticleVisual({ kind, problemTitle }: { kind: ArticleOgKind; problemTitle?: string }) {
    const editorial = kind === 'PROBLEM_EDITORIAL';
    const register = editorial
        ? problemTitle
            ? `Editorial · ${normalizeOgText(problemTitle, 28)}`
            : 'Problem editorial'
        : 'Community article';

    return (
        <div
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                padding: '30px 30px 26px',
            }}
        >
            <CornerMarker />
            <div
                style={{
                    display: 'flex',
                    color: OG_THEME.paperStrong,
                    fontSize: '16px',
                    fontWeight: 900,
                    letterSpacing: '2.4px',
                }}
            >
                {editorial ? 'EDITORIAL / ML' : 'ARTICLE / MLC'}
            </div>
            <div
                style={{
                    display: 'flex',
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <div
                    style={{
                        position: 'relative',
                        width: '236px',
                        height: '166px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: OG_THEME.paper,
                        border: `3px solid ${OG_THEME.ink}`,
                        color: OG_THEME.violet,
                        fontSize: '90px',
                        fontWeight: 900,
                        letterSpacing: '-7px',
                    }}
                >
                    Aa
                    <span
                        style={{
                            position: 'absolute',
                            top: '-15px',
                            left: '-15px',
                            width: '30px',
                            height: '30px',
                            display: 'flex',
                            backgroundColor: OG_THEME.citron,
                            border: `3px solid ${OG_THEME.ink}`,
                        }}
                    />
                    <span
                        style={{
                            position: 'absolute',
                            right: '-15px',
                            bottom: '-15px',
                            width: '30px',
                            height: '30px',
                            display: 'flex',
                            backgroundColor: OG_THEME.coral,
                            border: `3px solid ${OG_THEME.ink}`,
                        }}
                    />
                </div>
            </div>
            <div
                style={{
                    minHeight: '72px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: editorial ? OG_THEME.citron : OG_THEME.paper,
                    border: `3px solid ${OG_THEME.ink}`,
                    color: OG_THEME.ink,
                    fontSize: '17px',
                    fontWeight: 900,
                    lineHeight: 1.15,
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    padding: '12px 18px',
                }}
            >
                {register}
            </div>
        </div>
    );
}

function CountryVisual({ countryCode }: { countryCode: string }) {
    return (
        <div
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                paddingTop: '22px',
            }}
        >
            <CornerMarker />
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '178px',
                    lineHeight: 1,
                }}
            >
                {getCountryFlagEmoji(countryCode)}
            </div>
            <div
                style={{
                    display: 'flex',
                    marginTop: '30px',
                    color: OG_THEME.paper,
                    fontSize: '38px',
                    fontWeight: 900,
                    letterSpacing: '13px',
                    lineHeight: 1,
                    paddingLeft: '13px',
                }}
            >
                {countryCode}
            </div>
        </div>
    );
}

function ProfileVisual({
    username,
    countryCode,
    avatarDataUrl,
}: {
    username: string;
    countryCode: string | null;
    avatarDataUrl?: string;
}) {
    const identity = { username };
    const initials = getUserInitials(identity);
    const avatarTone = PROFILE_AVATAR_TONES[getUserAvatarTone(identity)];
    const flagEmoji = countryCode ? getCountryFlagEmoji(countryCode) : null;

    return (
        <div
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                display: 'flex',
            }}
        >
            <CornerMarker />
            <div
                style={{
                    position: 'absolute',
                    top: '48px',
                    left: '50px',
                    width: '248px',
                    height: '214px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: avatarTone.backgroundColor,
                    border: `3px solid ${OG_THEME.ink}`,
                    color: avatarTone.color,
                    fontSize: '104px',
                    fontWeight: 900,
                    lineHeight: 1,
                    overflow: 'hidden',
                }}
            >
                {avatarDataUrl ? (
                    <img
                        alt=""
                        src={avatarDataUrl}
                        width={248}
                        height={214}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: 'center',
                        }}
                    />
                ) : (
                    initials
                )}
            </div>
            <div
                style={{
                    position: 'absolute',
                    left: '50px',
                    bottom: '26px',
                    width: '248px',
                    height: '78px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: flagEmoji ? 'space-between' : 'center',
                    border: `3px solid ${OG_THEME.ink}`,
                    backgroundColor: flagEmoji ? OG_THEME.paper : OG_THEME.citron,
                    padding: flagEmoji ? '0 22px' : '0 16px',
                }}
            >
                {flagEmoji ? (
                    <>
                        <span style={{ display: 'flex', fontSize: '48px', lineHeight: 1 }}>
                            {flagEmoji}
                        </span>
                        <span
                            style={{
                                display: 'flex',
                                color: OG_THEME.ink,
                                fontSize: '27px',
                                fontWeight: 900,
                                letterSpacing: '8px',
                                paddingLeft: '8px',
                            }}
                        >
                            {countryCode}
                        </span>
                    </>
                ) : (
                    <span
                        style={{
                            display: 'flex',
                            color: OG_THEME.ink,
                            fontSize: '17px',
                            fontWeight: 900,
                            letterSpacing: '2px',
                            textTransform: 'uppercase',
                        }}
                    >
                        ML profile
                    </span>
                )}
            </div>
        </div>
    );
}

export function generateHomeImage(title: string, subtitle: string | undefined, logoUrl: string) {
    return (
        <NotebookOgShell
            eyebrow="Machine learning · competition platform"
            title={title}
            subtitle={subtitle}
            bottomLine="Learn · Build · Compete"
            logoUrl={logoUrl}
            visual={<RegisterVisual code="MLC / ARENA" mark="ML" register="Data · Model · Score" />}
        />
    );
}

export function generateGenericImage(
    title: string,
    subtitle: string | undefined,
    kind: PlatformOgKind,
    logoUrl: string,
    countryCode?: string | null,
) {
    const register = KIND_REGISTER[kind];

    return (
        <NotebookOgShell
            eyebrow={register.eyebrow}
            title={title}
            subtitle={subtitle}
            bottomLine={register.register}
            logoUrl={logoUrl}
            visual={
                <RegisterVisual
                    code={register.code}
                    mark={register.mark}
                    register={register.register}
                    countryCode={countryCode}
                />
            }
        />
    );
}

export function generateProblemImage(
    title: string,
    difficulty: ProblemDifficulty,
    problemId: number | undefined,
    logoUrl: string,
    authorLine?: string,
) {
    return (
        <NotebookOgShell
            eyebrow={problemId ? `Problem · #${problemId}` : 'Machine learning problem'}
            title={title}
            bottomLine={authorLine || 'Train · Validate · Submit'}
            logoUrl={logoUrl}
            visual={<ProblemVisual difficulty={difficulty} problemId={problemId} />}
        />
    );
}

export function generateCompetitionImage(
    title: string,
    status: CompetitionStatus,
    startDate: string,
    endDate: string,
    logoUrl: string,
    detailsLine?: string,
) {
    const statusLine =
        status === 'UPCOMING'
            ? 'Upcoming competition'
            : status === 'ACTIVE'
              ? 'Live now'
              : 'Results';

    return (
        <NotebookOgShell
            eyebrow={`Competition · ${statusLine}`}
            title={title}
            bottomLine={detailsLine || `${formatOgDate(startDate)} · ${formatOgDate(endDate)}`}
            logoUrl={logoUrl}
            visual={<CompetitionVisual status={status} startDate={startDate} endDate={endDate} />}
        />
    );
}

export function generateArticleImage(
    title: string,
    kind: ArticleOgKind,
    logoUrl: string,
    options: {
        excerpt?: string;
        problemTitle?: string;
        authorLine?: string;
    } = {},
) {
    return (
        <NotebookOgShell
            eyebrow={kind === 'PROBLEM_EDITORIAL' ? 'Problem editorial' : 'Community article'}
            title={title}
            subtitle={options.excerpt}
            bottomLine={options.authorLine || 'Written by the MLCompete community'}
            logoUrl={logoUrl}
            visual={<ArticleVisual kind={kind} problemTitle={options.problemTitle} />}
        />
    );
}

export function generateInstitutionImage(
    title: string,
    logoUrl: string,
    countryCode: string | null,
    location?: string,
) {
    return (
        <NotebookOgShell
            eyebrow="Educational institution"
            title={title}
            bottomLine={location || 'Competitors · Community · Rankings'}
            logoUrl={logoUrl}
            visual={
                <RegisterVisual
                    code="EDU / MLC"
                    mark="EDU"
                    register={location || 'MLCompete institution'}
                    countryCode={countryCode}
                />
            }
        />
    );
}

export function generateCountyImage(
    title: string,
    countyCode: string | undefined,
    logoUrl: string,
) {
    return (
        <NotebookOgShell
            eyebrow={countyCode ? `Romania · ${countyCode}` : 'Romania · County'}
            title={title}
            bottomLine="Institutions · Competitors · Rankings"
            logoUrl={logoUrl}
            visual={
                <RegisterVisual
                    code="RO / COUNTY"
                    mark="RO"
                    register={countyCode ? `County · ${countyCode}` : 'Romanian county'}
                    countryCode="RO"
                />
            }
        />
    );
}

export function generateCountryImage(title: string, countryCode: string, logoUrl: string) {
    return (
        <NotebookOgShell
            eyebrow={`Country · ${countryCode}`}
            title={title}
            bottomLine="Institutions, competitors and rankings"
            logoUrl={logoUrl}
            visual={<CountryVisual countryCode={countryCode} />}
        />
    );
}

export function generateProfileImage(
    username: string,
    stats: {
        rank?: number;
        totalScore?: number;
        problemsSolved?: number;
    },
    countryCode: string | null,
    logoUrl: string,
    avatarDataUrl?: string,
) {
    const renderedUsername = getRenderableOgText(username, 34, 'competitor');
    const usernameLabel = renderedUsername.startsWith('@')
        ? renderedUsername
        : `@${renderedUsername}`;
    const profileStats = [
        stats.rank !== undefined ? `#${formatOgMetric(stats.rank, 0)} Rank` : null,
        stats.totalScore !== undefined ? `${formatOgMetric(stats.totalScore)} Score` : null,
        stats.problemsSolved !== undefined
            ? `${formatOgMetric(stats.problemsSolved, 0)} Solved`
            : null,
    ].filter((stat): stat is string => stat !== null);

    return (
        <NotebookOgShell
            eyebrow="Competitor profile"
            title={usernameLabel}
            bottomLine={profileStats.length > 0 ? profileStats.join(' · ') : 'MLCompete member'}
            logoUrl={logoUrl}
            visual={
                <ProfileVisual
                    username={renderedUsername}
                    countryCode={countryCode}
                    avatarDataUrl={avatarDataUrl}
                />
            }
        />
    );
}
