import type { RequiredFieldsUpdateRequest } from '@/lib/types';

export const registrationFields = [
    'firstName',
    'lastName',
    'grade',
    'phone',
    'coordinatorTeacher',
    'schoolTeacher',
] as const satisfies ReadonlyArray<keyof RequiredFieldsUpdateRequest>;
