import { permanentRedirect } from 'next/navigation';

export default async function LegacyCountyDetailPage({
    params,
}: {
    params: Promise<{ id: string; locale: string }>;
}) {
    const { id, locale } = await params;
    permanentRedirect(`/${locale}/countries/RO/counties/${id}`);
}
