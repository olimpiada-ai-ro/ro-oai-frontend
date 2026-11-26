'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchApi } from '@/lib/api';

type HybridState = {
    projectBrief: string;
    projectMaxScore: number;
    projectCriteria?: { title: string; description: string; maxPoints: number }[];
    criterionScores?: number[] | null;
    questions: { prompt: string; options: string[]; points: number }[];
    answers: number[] | null;
    theorySubmittedAt: string | null;
    projectFilename: string | null;
    projectSubmittedAt: string | null;
    theoryScore: number | null;
    projectScore: number | null;
    feedback: string | null;
};

const maxFileBytes = 20 * 1024 * 1024;

export function HybridCompetitionPanel({
    competitionId,
    readOnly,
    onEntryCheck,
}: {
    competitionId: number;
    readOnly: boolean;
    onEntryCheck?: () => void;
}) {
    const t = useTranslations('competitions.hybrid');
    const common = useTranslations('common');
    const base = `${process.env.NEXT_PUBLIC_API_BASE_URL}/competitions/${competitionId}/hybrid`;
    const [state, setState] = useState<HybridState | null>(null);
    const [choices, setChoices] = useState<Record<number, number>>({});
    const [file, setFile] = useState<File | null>(null);
    const [error, setError] = useState<
        'unavailable' | 'denied' | 'failed' | 'fileError' | 'conflict' | null
    >(null);
    const [pending, setPending] = useState<'theory' | 'project' | null>(null);
    const [revision, setRevision] = useState(0);
    const fileInput = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const controller = new AbortController();
        async function load() {
            try {
                const response = await fetchApi(base, { signal: controller.signal });
                if (controller.signal.aborted) return;
                if (!response.ok) {
                    setState(null);
                    setError(
                        response.status === 409
                            ? 'unavailable'
                            : response.status === 403
                              ? 'denied'
                              : 'failed',
                    );
                    return;
                }
                const data: HybridState = await response.json();
                if (!controller.signal.aborted) {
                    setState(data);
                    setError(null);
                }
            } catch {
                if (!controller.signal.aborted) {
                    setState(null);
                    setError('failed');
                }
            }
        }
        void load();
        return () => controller.abort();
    }, [base, revision, readOnly]);

    async function submit(kind: 'theory' | 'project') {
        if (readOnly || pending || !state) return;
        let request: RequestInit;
        if (kind === 'theory') {
            if (
                state.theorySubmittedAt ||
                !state.questions.every((_, i) => choices[i] !== undefined)
            )
                return;
            request = {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ answers: state.questions.map((_, i) => choices[i]) }),
            };
        } else {
            if (!file) return;
            if (!/\.(zip|pdf)$/i.test(file.name) || !file.size || file.size > maxFileBytes) {
                setError('fileError');
                return;
            }
            const body = new FormData();
            body.append('file', file);
            request = { method: 'PUT', body };
        }

        setPending(kind);
        setError(null);
        try {
            const response = await fetchApi(`${base}/${kind}`, request);
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    setState(null);
                    setError('denied');
                } else if (response.status === 409) {
                    setError('conflict');
                } else if (kind === 'project' && [400, 413, 415].includes(response.status)) {
                    setError('fileError');
                } else {
                    setError('failed');
                }
                return;
            }
            const data: HybridState = await response.json();
            setState(data);
            if (kind === 'project') {
                setFile(null);
                if (fileInput.current) fileInput.current.value = '';
            }
        } catch {
            setError('failed');
        } finally {
            setPending(null);
        }
    }

    const errorMessage = error && (
        <div
            role="alert"
            className="flex flex-wrap items-center gap-3 border border-[var(--platform-line-strong)] p-4"
        >
            <span>{t(error)}</span>
            {error === 'denied' && onEntryCheck && (
                <Button type="button" variant="outline" onClick={onEntryCheck}>
                    {t('entryCheck')}
                </Button>
            )}
            {error !== 'fileError' && (
                <Button
                    type="button"
                    variant="outline"
                    disabled={!!pending}
                    onClick={() => setRevision((n) => n + 1)}
                >
                    {common('retry')}
                </Button>
            )}
        </div>
    );
    if (!state) return errorMessage || <p role="status">{common('loading')}</p>;

    const hasTheory = !!state.theorySubmittedAt;
    const canSubmitTheory =
        state.questions.length > 0 && state.questions.every((_, i) => choices[i] !== undefined);
    return (
        <div className="space-y-6">
            {errorMessage}
            <section className="platform-panel space-y-5 p-5 sm:p-8">
                <h2 className="text-xl font-bold">{t('theory')}</h2>
                {hasTheory ? (
                    <p role="status">{t('theoryReceived')}</p>
                ) : (
                    <p>{t(readOnly ? 'theoryMissing' : 'theoryInstructions')}</p>
                )}
                <form
                    className="space-y-6"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void submit('theory');
                    }}
                >
                    {state.questions.map((question, index) => (
                        <fieldset
                            key={index}
                            disabled={readOnly || hasTheory || !!pending}
                            className="space-y-2 border-t border-[var(--platform-line)]"
                        >
                            <legend className="whitespace-pre-wrap break-words pe-3 font-semibold">
                                {index + 1}. {question.prompt}
                                <span className="ms-2 text-sm font-normal text-[var(--platform-ink-muted)]">
                                    {t('points', { value: question.points })}
                                </span>
                            </legend>
                            {question.options.map((option, optionIndex) => (
                                <label
                                    key={optionIndex}
                                    className="flex min-h-10 items-start gap-3 py-2"
                                >
                                    <input
                                        type="radio"
                                        name={`question-${competitionId}-${index}`}
                                        required
                                        className="mt-1 accent-[var(--platform-violet)]"
                                        checked={
                                            (hasTheory
                                                ? state.answers?.[index]
                                                : choices[index]) === optionIndex
                                        }
                                        onChange={() =>
                                            setChoices((values) => ({
                                                ...values,
                                                [index]: optionIndex,
                                            }))
                                        }
                                    />
                                    <span className="whitespace-pre-wrap break-words">
                                        {option}
                                    </span>
                                </label>
                            ))}
                        </fieldset>
                    ))}
                    {!readOnly && !hasTheory && (
                        <Button type="submit" disabled={!canSubmitTheory || !!pending}>
                            {t(pending === 'theory' ? 'submitting' : 'submitTheory')}
                        </Button>
                    )}
                </form>
                {state.theoryScore != null && (
                    <p className="font-semibold">
                        {t('score', {
                            score: state.theoryScore,
                            maximum: state.questions.reduce((sum, q) => sum + q.points, 0),
                        })}
                    </p>
                )}
            </section>
            <section className="platform-panel space-y-5 p-5 sm:p-8">
                <div>
                    <h2 className="text-xl font-bold">{t('project')}</h2>
                    <p className="mt-2 whitespace-pre-wrap break-words">{state.projectBrief}</p>
                    <p className="mt-2 text-sm text-[var(--platform-ink-muted)]">
                        {t('maximum', { maximum: state.projectMaxScore })}
                    </p>
                </div>
                {!!state.projectCriteria?.length && (
                    <div>
                        <h3 id={`project-criteria-${competitionId}`} className="font-semibold">
                            {t('evaluationCriteria')}
                        </h3>
                        <ul
                            aria-labelledby={`project-criteria-${competitionId}`}
                            className="mt-2 divide-y divide-[var(--platform-line)]"
                        >
                            {state.projectCriteria.map((criterion, index) => {
                                const awarded = state.criterionScores?.[index];
                                return (
                                    <li key={index} className="py-3">
                                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                                            <p className="min-w-0 break-words font-medium">
                                                {criterion.title}
                                            </p>
                                            <span className="text-sm text-[var(--platform-ink-muted)]">
                                                {state.projectScore != null && awarded != null
                                                    ? t('score', {
                                                          score: awarded,
                                                          maximum: criterion.maxPoints,
                                                      })
                                                    : t('points', { value: criterion.maxPoints })}
                                            </span>
                                        </div>
                                        {criterion.description && (
                                            <p className="mt-1 whitespace-pre-wrap break-words text-sm">
                                                {criterion.description}
                                            </p>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
                {state.projectFilename ? (
                    <p role="status" className="break-all">
                        {t('projectReceived', { filename: state.projectFilename })}
                    </p>
                ) : readOnly ? (
                    <p>{t('projectMissing')}</p>
                ) : null}
                {!readOnly && (
                    <form
                        className="space-y-3"
                        onSubmit={(event) => {
                            event.preventDefault();
                            void submit('project');
                        }}
                    >
                        <label
                            className="block font-semibold"
                            htmlFor={`project-file-${competitionId}`}
                        >
                            {t('fileLabel')}
                        </label>
                        <p
                            id={`project-help-${competitionId}`}
                            className="text-sm text-[var(--platform-ink-muted)]"
                        >
                            {t('fileHelp')}
                        </p>
                        <Input
                            ref={fileInput}
                            id={`project-file-${competitionId}`}
                            aria-describedby={`project-help-${competitionId}`}
                            type="file"
                            accept=".zip,.pdf"
                            disabled={!!pending}
                            onChange={(event) => {
                                setFile(event.target.files?.[0] ?? null);
                                setError(null);
                            }}
                        />
                        <Button type="submit" disabled={!file || !!pending}>
                            {t(
                                pending === 'project'
                                    ? 'uploading'
                                    : state.projectFilename
                                      ? 'replaceProject'
                                      : 'uploadProject',
                            )}
                        </Button>
                    </form>
                )}
                {state.projectScore != null && (
                    <p className="font-semibold">
                        {t('score', { score: state.projectScore, maximum: state.projectMaxScore })}
                    </p>
                )}
                {state.feedback && (
                    <div>
                        <h3 className="font-semibold">{t('feedback')}</h3>
                        <p className="mt-1 whitespace-pre-wrap break-words">{state.feedback}</p>
                    </div>
                )}
            </section>
        </div>
    );
}
