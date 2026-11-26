'use client';

import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { registrationFields } from '@/lib/competition-registration';
import type { RequiredFieldsUpdateRequest } from '@/lib/types';

type Props = {
    requiredFields: string[];
    validGrades?: string[];
    values: RequiredFieldsUpdateRequest;
    onChange: (field: keyof RequiredFieldsUpdateRequest, value: string) => void;
    maxLength?: number;
};

export function CompetitionRegistrationFields({
    requiredFields,
    validGrades,
    values,
    onChange,
    maxLength,
}: Props) {
    const t = useTranslations('requiredFields');
    const fields = registrationFields.filter((field) => requiredFields.includes(field));
    if (!fields.length) return null;

    return (
        <div className="grid gap-5 sm:grid-cols-2">
            {fields.map((field) => (
                <div className="space-y-2" key={field}>
                    <Label htmlFor={field}>{t(`fields.${field}`)}</Label>
                    {field === 'grade' && validGrades?.length ? (
                        <Select
                            required
                            value={values.grade || ''}
                            onValueChange={(value) => onChange(field, value)}
                        >
                            <SelectTrigger
                                id={field}
                                className="min-h-11 rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)]"
                            >
                                <SelectValue placeholder={t('fields.grade')} />
                            </SelectTrigger>
                            <SelectContent>
                                {validGrades.map((grade) => (
                                    <SelectItem key={grade} value={grade}>
                                        {grade}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
                        <Input
                            id={field}
                            type={field === 'phone' ? 'tel' : 'text'}
                            required
                            maxLength={maxLength}
                            value={values[field] || ''}
                            onChange={(e) => onChange(field, e.target.value)}
                            className="min-h-11 rounded-none border-[var(--platform-line-strong)] bg-[var(--platform-paper)]"
                        />
                    )}
                </div>
            ))}
        </div>
    );
}
