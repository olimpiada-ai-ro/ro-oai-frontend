import { permanentRedirect } from 'next/navigation';

export default async function LegacyCountiesPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    permanentRedirect(`/${locale}/countries`);
}
