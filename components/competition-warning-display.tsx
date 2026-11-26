'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { DismissibleAlert } from '@/components/dismissible-alert';

type CompetitionWarningDisplayProps = {
    // When the countdown should end. Accepts a Date, timestamp (ms), or ISO string.
    endTime: Date | number | string;
    storageKey: string;
    hybrid?: boolean;
};

function parseEndTime(endTime: Date | number | string): number {
    if (endTime instanceof Date) return endTime.getTime();
    if (typeof endTime === 'number') return endTime;
    // string
    const dt = new Date(endTime);
    return dt.getTime();
}

export function CompetitionWarningDisplay({
    endTime,
    storageKey,
    hybrid,
}: CompetitionWarningDisplayProps) {
    const t = useTranslations('competitions.details');
    const target = useMemo(() => parseEndTime(endTime), [endTime]);

    const [currentTime, setCurrentTime] = useState(new Date().getTime());
    const [dismissed, setDismissed] = useState<null | string>(null);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date().getTime());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const remainingTimeMs = target - currentTime;
    const tenMinutesMs = 10 * 60 * 1000;
    const showCountdownAlert = remainingTimeMs > 0 && remainingTimeMs < tenMinutesMs;

    if (!showCountdownAlert || dismissed === 'true') {
        return null;
    }

    return (
        <DismissibleAlert
            message={t(hybrid ? 'hybridCountdown' : 'countdownAlert')}
            storageKey={storageKey}
            onDismiss={() => setDismissed('true')}
            onLoad={(saved) => {
                setDismissed(saved);
            }}
            className="mb-6"
        />
    );
}

export default CompetitionWarningDisplay;
