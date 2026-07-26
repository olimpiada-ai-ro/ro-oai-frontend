import { describe, expect, it } from 'vitest';

import { getCountryDisplayName, getInstitutionLocationLabel } from './country-display';
import type { Country, County } from './types';

const romania: Country = {
    code: 'RO',
    name: 'Romania',
    nameRo: 'România',
    flagEmoji: '🇷🇴',
};
const algeria: Country = {
    code: 'DZ',
    name: 'Algeria',
    nameRo: 'Algeria',
    flagEmoji: '🇩🇿',
};
const bucharest: County = { id: 1, name: 'București', code: 'B' };
const international: County = { id: 2, name: 'International', code: 'XX' };

describe('country display helpers', () => {
    it('localizes ISO country names when the runtime supports the locale', () => {
        expect(getCountryDisplayName(romania, 'ro')).toBe('România');
        expect(getCountryDisplayName(algeria, 'fr')).toBe('Algérie');
    });

    it('includes counties only for Romanian institutions', () => {
        expect(getInstitutionLocationLabel({ country: romania, county: bucharest }, 'ro')).toBe(
            'București, România',
        );
        expect(getInstitutionLocationLabel({ country: algeria, county: international }, 'en')).toBe(
            'Algeria',
        );
    });
});
