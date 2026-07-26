'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, CheckCircle2, MapPin, ArrowRight } from 'lucide-react';
import { Institution } from '@/lib/types';
import { getInstitutionLocationLabel } from '@/lib/country-display';

interface CurrentInstitutionDisplayProps {
    institution: Institution;
    onChangeInstitution: () => void;
}

export function CurrentInstitutionDisplay({
    institution,
    onChangeInstitution,
}: CurrentInstitutionDisplayProps) {
    const t = useTranslations('onboarding.institutionSelection');
    const locale = useLocale();
    const locationLabel = getInstitutionLocationLabel(institution, locale);

    // Map institution type to display text
    const getInstitutionTypeLabel = (type: string) => {
        const typeMap: Record<string, string> = {
            GIMNAZIU: t('types.gimnaziu'),
            LICEU: t('types.liceu'),
            FACULTATE: t('types.facultate'),
        };
        return typeMap[type] || type;
    };

    return (
        <Card
            className="border-green-500/20 bg-card/50"
            role="article"
            aria-labelledby="current-institution-title"
        >
            <CardContent className="p-4 sm:p-6">
                <div className="flex items-start gap-4">
                    <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-green-600 dark:text-green-400"
                        role="img"
                        aria-label={t('completedIconLabel')}
                    >
                        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    </div>

                    <div className="flex-1 space-y-3">
                        <div>
                            <h3
                                id="current-institution-title"
                                className="text-lg font-semibold flex items-center gap-2"
                            >
                                {t('title')}
                                <CheckCircle2
                                    className="h-5 w-5 text-green-600 dark:text-green-400"
                                    aria-label={t('completedBadgeLabel')}
                                />
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                {t('currentInstitutionDescription')}
                            </p>
                        </div>

                        <div
                            className="rounded-lg bg-green-500/5 border border-green-500/20 p-4 space-y-2"
                            role="region"
                            aria-label={t('institutionDetailsLabel')}
                        >
                            <div className="flex items-start gap-3">
                                <Building2
                                    className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5"
                                    aria-hidden="true"
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-foreground break-words">
                                        {institution.name}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                        <Badge
                                            variant="secondary"
                                            className="text-xs bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20"
                                            role="status"
                                        >
                                            {getInstitutionTypeLabel(institution.type)}
                                        </Badge>
                                        {locationLabel ? (
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <MapPin className="h-3 w-3" aria-hidden="true" />
                                                <span>{locationLabel}</span>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Button
                            onClick={onChangeInstitution}
                            variant="outline"
                            className="w-full sm:w-auto"
                            aria-label={t('changeInstitutionAriaLabel')}
                        >
                            {t('changeInstitution')}
                            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
