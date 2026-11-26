import type React from 'react';
import { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '../globals.css';
import 'katex/dist/katex.min.css';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import SessionProvider from '@/components/session-provider';
import ProtectedLayout from '@/app/(protected)/layout';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import { Toaster as RadixToaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SkipToContent } from '@/components/skip-to-content';
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts';
import { SubmissionNotificationProvider } from '@/components/submission-notification-provider';
import { CommentNotificationProvider } from '@/components/comment-notification-provider';
import { AchievementNotificationProvider } from '@/components/achievements/achievement-notification-provider';
import { LevelNotificationProvider } from '@/components/level/level-notification-provider';
import { LevelUpIntegration } from '@/components/level/level-up-integration';
import { NotificationsProvider } from '@/components/notifications-provider';
import { CurrentUserProvider } from '@/components/providers/current-user-provider';
import { DisqualificationNotificationProvider } from '@/components/disqualification-notification-provider';
import { LocaleProvider } from '@/components/locale-provider';
import { getMessages, getServerLocaleDirection } from '@/lib/i18n-server';
import { TranslationDevTools } from '@/components/translation-dev-tools';
import { generateOrganizationSchema } from '@/lib/seo/structured-data';
import { StructuredData } from '@/components/structured-data';
import { AnalyticsProvider } from '@/components/analytics-provider';
import { ConsentBanner } from '@/components/consent-banner';
import { OnboardingProvider } from '@/components/onboarding';
import { SUPPORTED_LOCALES, Locale } from '@/lib/types';
import { getSession } from '@/lib/auth';
import { AppearanceProvider } from '@/components/providers/appearance-provider';
import { createAppearanceBootstrapScript } from '@/lib/appearance';
import { getServerAppearancePreferences } from '@/lib/appearance-server';
import { notFound } from 'next/navigation';
import { OG_IMAGE_DIMENSIONS, SITE_CONFIG } from '@/lib/seo/config';

const inter = Inter({ subsets: ['latin'] });

/**
 * Global metadata configuration
 * Page-specific metadata will override these defaults
 */
export const metadata: Metadata = {
    title: 'MLCompete - Machine Learning Competition Platform',
    description: 'Evaluate your machine learning models and compete with others.',
    generator: 'ro-oai-frontend',
    applicationName: 'MLCompete',
    keywords: [
        'machine learning',
        'ML competition',
        'data science',
        'AI challenges',
        'model evaluation',
        'leaderboard',
    ],
    authors: [{ name: 'MLCompete Team' }],
    creator: 'MLCompete',
    publisher: 'MLCompete',
    formatDetection: {
        email: false,
        address: false,
        telephone: false,
    },
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
    icons: {
        icon: '/favicon.ico',
        shortcut: '/favicon.ico',
        apple: '/logo.png',
    },
    openGraph: {
        type: 'website',
        siteName: SITE_CONFIG.name,
        title: 'MLCompete - Machine Learning Competition Platform',
        description: 'Evaluate your machine learning models and compete with others.',
        images: [
            {
                url: SITE_CONFIG.ogImage,
                width: OG_IMAGE_DIMENSIONS.width,
                height: OG_IMAGE_DIMENSIONS.height,
                alt: 'MLCompete - Machine Learning Competition Platform',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'MLCompete - Machine Learning Competition Platform',
        description: 'Evaluate your machine learning models and compete with others.',
        images: [SITE_CONFIG.ogImage],
    },
};

/**
 * Viewport configuration
 * Defines viewport settings for responsive design
 */
export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#ffffff' },
        { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
    ],
};

/**
 * Generate static params for all supported locales
 * This enables static generation for all locale routes
 */
export function generateStaticParams() {
    return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

type Props = {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
    const { locale } = await params;

    // Validate locale
    if (!SUPPORTED_LOCALES.includes(locale as Locale)) {
        notFound();
    }

    const validLocale = locale as Locale;
    const sessionPromise = getSession();
    const [messages, session, initialAppearance] = await Promise.all([
        getMessages(validLocale),
        sessionPromise,
        sessionPromise.then(getServerAppearancePreferences),
    ]);
    const direction = getServerLocaleDirection(validLocale);

    // Generate global structured data (Organization schema)
    const organizationSchema = generateOrganizationSchema(validLocale);

    return (
        <html
            lang={validLocale}
            dir={direction}
            data-interface-theme={initialAppearance.uiTheme}
            data-color-mode={initialAppearance.colorMode}
            suppressHydrationWarning
        >
            <head>
                <StructuredData data={organizationSchema} />
                <script
                    dangerouslySetInnerHTML={{
                        __html: createAppearanceBootstrapScript(
                            initialAppearance,
                            Boolean(session),
                        ),
                    }}
                />
            </head>
            <body className={inter.className}>
                <AppearanceProvider
                    initialPreferences={initialAppearance}
                    authenticated={Boolean(session)}
                >
                    <TooltipProvider>
                        <Suspense fallback={null}>
                            <LocaleProvider messages={messages} locale={validLocale}>
                                <SessionProvider session={session}>
                                    <CurrentUserProvider>
                                        <AnalyticsProvider>
                                            <ProtectedLayout>
                                                <SubmissionNotificationProvider>
                                                    <CommentNotificationProvider>
                                                        <AchievementNotificationProvider>
                                                            <NotificationsProvider>
                                                                <DisqualificationNotificationProvider>
                                                                    <LevelNotificationProvider>
                                                                        <LevelUpIntegration />
                                                                        <SkipToContent />
                                                                        <KeyboardShortcuts />
                                                                        <TranslationDevTools />
                                                                        <div className="flex flex-col min-h-screen">
                                                                            <Header />
                                                                            <main
                                                                                id="main-content"
                                                                                className="flex-1 container mx-auto px-4 sm:px-6 py-4 sm:py-8"
                                                                                tabIndex={-1}
                                                                            >
                                                                                {children}
                                                                            </main>
                                                                            <Footer />
                                                                        </div>
                                                                        <OnboardingProvider />
                                                                        <ConsentBanner />
                                                                        <RadixToaster />
                                                                    </LevelNotificationProvider>
                                                                </DisqualificationNotificationProvider>
                                                            </NotificationsProvider>
                                                        </AchievementNotificationProvider>
                                                    </CommentNotificationProvider>
                                                </SubmissionNotificationProvider>
                                            </ProtectedLayout>
                                        </AnalyticsProvider>
                                    </CurrentUserProvider>
                                </SessionProvider>
                            </LocaleProvider>
                        </Suspense>
                        <SonnerToaster />
                    </TooltipProvider>
                </AppearanceProvider>
            </body>
        </html>
    );
}
