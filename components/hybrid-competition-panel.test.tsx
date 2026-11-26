import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HybridCompetitionPanel } from '@/components/hybrid-competition-panel';
import { fetchApi } from '@/lib/api';
import messages from '@/locales/en.json';

vi.mock('@/lib/api', () => ({ fetchApi: vi.fn() }));

const initial = {
    projectBrief: 'Classify a collection of fruit.',
    projectMaxScore: 20,
    questions: [{ prompt: 'Select a metric.', options: ['Accuracy', 'CSV'], points: 5 }],
    answers: null,
    theorySubmittedAt: null,
    projectFilename: null,
    projectSubmittedAt: null,
    theoryScore: null,
    projectScore: null,
    feedback: null,
};

const projectCriteria = [
    { title: 'Validation', description: 'Test against unseen examples.', maxPoints: 12 },
    { title: 'Presentation', description: '', maxPoints: 8 },
];

function renderPanel(readOnly = false) {
    return render(
        <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
            <HybridCompetitionPanel competitionId={42} readOnly={readOnly} />
        </NextIntlClientProvider>,
    );
}

describe('hybrid competition submissions', () => {
    const api = vi.mocked(fetchApi);
    beforeEach(() => api.mockReset());

    it('submits complete answers in question order once and keeps unpublished scores private', async () => {
        api.mockResolvedValueOnce(Response.json(initial)).mockResolvedValueOnce(
            Response.json({ ...initial, answers: [0], theorySubmittedAt: '2026-11-26T10:03:00Z' }),
        );
        renderPanel();
        const submit = (await screen.findByRole('button', {
            name: 'Submit final answers',
        })) as HTMLButtonElement;
        expect(submit.disabled).toBe(true);
        fireEvent.click(screen.getByLabelText('Accuracy'));
        fireEvent.click(submit);
        await screen.findByText('Your final answers have been received.');
        expect(api.mock.calls[1]).toEqual([
            expect.stringMatching(/\/competitions\/42\/hybrid\/theory$/),
            {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ answers: [0] }),
            },
        ]);
        expect(screen.queryByRole('button', { name: 'Submit final answers' })).toBeNull();
        expect(screen.queryByText(/^Score:/)).toBeNull();
    });

    it('rejects an unsupported file then sends a valid replacement and displays the saved filename', async () => {
        api.mockResolvedValueOnce(
            Response.json({ ...initial, projectFilename: 'draft.pdf' }),
        ).mockResolvedValueOnce(Response.json({ ...initial, projectFilename: 'final.zip' }));
        renderPanel();
        const input = await screen.findByLabelText('Project file');
        const upload = screen.getByRole('button', { name: 'Replace submitted file' });
        fireEvent.change(input, { target: { files: [new File(['bad'], 'run.exe')] } });
        fireEvent.click(upload);
        expect(await screen.findByRole('alert')).toBeTruthy();
        expect(api).toHaveBeenCalledTimes(1);
        fireEvent.change(input, { target: { files: [new File(['project'], 'final.zip')] } });
        fireEvent.click(upload);
        await screen.findByText('Submitted file: final.zip');
        const [url, options] = api.mock.calls[1]!;
        expect(url).toMatch(/\/competitions\/42\/hybrid\/project$/);
        expect(options?.method).toBe('PUT');
        expect(((options?.body as FormData).get('file') as File).name).toBe('final.zip');
    });

    it('shows a released zero score and jury feedback after close without submission controls', async () => {
        api.mockResolvedValueOnce(
            Response.json({
                ...initial,
                theoryScore: 0,
                projectScore: 17,
                feedback: 'Document the training data.',
            }),
        );
        renderPanel(true);
        await screen.findByText('Score: 0 / 5');
        expect(screen.getByText('Score: 17 / 20')).toBeTruthy();
        expect(screen.getByText('Document the training data.')).toBeTruthy();
        expect(screen.queryByText('Project evaluation criteria')).toBeNull();
        expect(screen.queryByLabelText('Project file')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Submit final answers' })).toBeNull();
    });

    it('shows the organizer’s criteria and point limits before submission', async () => {
        api.mockResolvedValueOnce(
            Response.json({ ...initial, projectCriteria, criterionScores: null }),
        );
        renderPanel();
        const rubric = await screen.findByRole('list', { name: 'Project evaluation criteria' });
        const [validation, presentation] = within(rubric).getAllByRole('listitem');
        expect(within(validation!).getByText('Validation')).toBeTruthy();
        expect(within(validation!).getByText('Test against unseen examples.')).toBeTruthy();
        expect(within(validation!).getByText('12 points')).toBeTruthy();
        expect(within(presentation!).getByText('Presentation')).toBeTruthy();
        expect(within(presentation!).getByText('8 points')).toBeTruthy();
        expect(within(rubric).queryByText(/^Score:/)).toBeNull();
    });

    it('pairs released criterion scores, including zero, with their original limits', async () => {
        api.mockResolvedValueOnce(
            Response.json({
                ...initial,
                projectCriteria,
                criterionScores: [0, 7],
                projectScore: 7,
            }),
        );
        renderPanel(true);
        const rubric = await screen.findByRole('list', { name: 'Project evaluation criteria' });
        const [validation, presentation] = within(rubric).getAllByRole('listitem');
        expect(within(validation!).getByText('Score: 0 / 12')).toBeTruthy();
        expect(within(presentation!).getByText('Score: 7 / 8')).toBeTruthy();
        expect(screen.getByText('Score: 7 / 20')).toBeTruthy();
    });

    it('loads no materials until ready, then retries the same competition', async () => {
        api.mockResolvedValueOnce(new Response(null, { status: 409 })).mockResolvedValueOnce(
            Response.json(initial),
        );
        renderPanel();
        await screen.findByRole('alert');
        expect(screen.queryByLabelText('Project file')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        await screen.findByLabelText('Project file');
        await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
    });
});
