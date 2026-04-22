/**
 * ISO 3166-1 country data with dial code and emoji flag.
 *
 * Hand-curated list covering MENA + global markets relevant to the academy.
 * Format matches the shape any <select> expects ({ iso2, name, dial, flag }).
 *
 * Kept local (no extra npm dep) to respect the "keep changes minimal" rule.
 * If this list ever needs to grow to full ISO-3166, swap in `country-codes`
 * or similar in a future PR.
 */

export interface Country {
  /** ISO 3166-1 alpha-2. Stable id. */
  iso2: string;
  /** Human-readable English name. Used for display; UI can localize via i18n. */
  name: string;
  /** International dial code without leading '+'. */
  dial: string;
  /** Emoji flag — regional indicator symbols for iso2. */
  flag: string;
}

export const COUNTRIES: ReadonlyArray<Country> = [
  { iso2: 'SA', name: 'Saudi Arabia',        dial: '966', flag: '🇸🇦' },
  { iso2: 'AE', name: 'United Arab Emirates',dial: '971', flag: '🇦🇪' },
  { iso2: 'KW', name: 'Kuwait',              dial: '965', flag: '🇰🇼' },
  { iso2: 'QA', name: 'Qatar',               dial: '974', flag: '🇶🇦' },
  { iso2: 'BH', name: 'Bahrain',             dial: '973', flag: '🇧🇭' },
  { iso2: 'OM', name: 'Oman',                dial: '968', flag: '🇴🇲' },
  { iso2: 'YE', name: 'Yemen',               dial: '967', flag: '🇾🇪' },
  { iso2: 'EG', name: 'Egypt',               dial: '20',  flag: '🇪🇬' },
  { iso2: 'SD', name: 'Sudan',               dial: '249', flag: '🇸🇩' },
  { iso2: 'LY', name: 'Libya',               dial: '218', flag: '🇱🇾' },
  { iso2: 'TN', name: 'Tunisia',             dial: '216', flag: '🇹🇳' },
  { iso2: 'DZ', name: 'Algeria',             dial: '213', flag: '🇩🇿' },
  { iso2: 'MA', name: 'Morocco',             dial: '212', flag: '🇲🇦' },
  { iso2: 'MR', name: 'Mauritania',          dial: '222', flag: '🇲🇷' },
  { iso2: 'JO', name: 'Jordan',              dial: '962', flag: '🇯🇴' },
  { iso2: 'PS', name: 'Palestine',           dial: '970', flag: '🇵🇸' },
  { iso2: 'LB', name: 'Lebanon',             dial: '961', flag: '🇱🇧' },
  { iso2: 'SY', name: 'Syria',               dial: '963', flag: '🇸🇾' },
  { iso2: 'IQ', name: 'Iraq',                dial: '964', flag: '🇮🇶' },
  { iso2: 'TR', name: 'Türkiye',             dial: '90',  flag: '🇹🇷' },
  { iso2: 'IR', name: 'Iran',                dial: '98',  flag: '🇮🇷' },
  { iso2: 'PK', name: 'Pakistan',            dial: '92',  flag: '🇵🇰' },
  { iso2: 'IN', name: 'India',               dial: '91',  flag: '🇮🇳' },
  { iso2: 'BD', name: 'Bangladesh',          dial: '880', flag: '🇧🇩' },
  { iso2: 'ID', name: 'Indonesia',           dial: '62',  flag: '🇮🇩' },
  { iso2: 'MY', name: 'Malaysia',            dial: '60',  flag: '🇲🇾' },
  { iso2: 'SG', name: 'Singapore',           dial: '65',  flag: '🇸🇬' },
  { iso2: 'BN', name: 'Brunei',              dial: '673', flag: '🇧🇳' },
  { iso2: 'NG', name: 'Nigeria',             dial: '234', flag: '🇳🇬' },
  { iso2: 'SN', name: 'Senegal',             dial: '221', flag: '🇸🇳' },
  { iso2: 'SO', name: 'Somalia',             dial: '252', flag: '🇸🇴' },
  { iso2: 'DJ', name: 'Djibouti',            dial: '253', flag: '🇩🇯' },
  { iso2: 'KM', name: 'Comoros',             dial: '269', flag: '🇰🇲' },
  { iso2: 'ZA', name: 'South Africa',        dial: '27',  flag: '🇿🇦' },
  { iso2: 'KE', name: 'Kenya',               dial: '254', flag: '🇰🇪' },
  { iso2: 'ET', name: 'Ethiopia',            dial: '251', flag: '🇪🇹' },
  { iso2: 'TZ', name: 'Tanzania',            dial: '255', flag: '🇹🇿' },
  { iso2: 'GB', name: 'United Kingdom',      dial: '44',  flag: '🇬🇧' },
  { iso2: 'IE', name: 'Ireland',             dial: '353', flag: '🇮🇪' },
  { iso2: 'FR', name: 'France',              dial: '33',  flag: '🇫🇷' },
  { iso2: 'DE', name: 'Germany',             dial: '49',  flag: '🇩🇪' },
  { iso2: 'NL', name: 'Netherlands',         dial: '31',  flag: '🇳🇱' },
  { iso2: 'BE', name: 'Belgium',             dial: '32',  flag: '🇧🇪' },
  { iso2: 'ES', name: 'Spain',               dial: '34',  flag: '🇪🇸' },
  { iso2: 'IT', name: 'Italy',               dial: '39',  flag: '🇮🇹' },
  { iso2: 'SE', name: 'Sweden',              dial: '46',  flag: '🇸🇪' },
  { iso2: 'NO', name: 'Norway',              dial: '47',  flag: '🇳🇴' },
  { iso2: 'DK', name: 'Denmark',             dial: '45',  flag: '🇩🇰' },
  { iso2: 'FI', name: 'Finland',             dial: '358', flag: '🇫🇮' },
  { iso2: 'CH', name: 'Switzerland',         dial: '41',  flag: '🇨🇭' },
  { iso2: 'AT', name: 'Austria',             dial: '43',  flag: '🇦🇹' },
  { iso2: 'PL', name: 'Poland',              dial: '48',  flag: '🇵🇱' },
  { iso2: 'RO', name: 'Romania',             dial: '40',  flag: '🇷🇴' },
  { iso2: 'GR', name: 'Greece',              dial: '30',  flag: '🇬🇷' },
  { iso2: 'RU', name: 'Russia',              dial: '7',   flag: '🇷🇺' },
  { iso2: 'UA', name: 'Ukraine',             dial: '380', flag: '🇺🇦' },
  { iso2: 'AZ', name: 'Azerbaijan',          dial: '994', flag: '🇦🇿' },
  { iso2: 'KZ', name: 'Kazakhstan',          dial: '7',   flag: '🇰🇿' },
  { iso2: 'UZ', name: 'Uzbekistan',          dial: '998', flag: '🇺🇿' },
  { iso2: 'AF', name: 'Afghanistan',         dial: '93',  flag: '🇦🇫' },
  { iso2: 'US', name: 'United States',       dial: '1',   flag: '🇺🇸' },
  { iso2: 'CA', name: 'Canada',              dial: '1',   flag: '🇨🇦' },
  { iso2: 'MX', name: 'Mexico',              dial: '52',  flag: '🇲🇽' },
  { iso2: 'BR', name: 'Brazil',              dial: '55',  flag: '🇧🇷' },
  { iso2: 'AR', name: 'Argentina',           dial: '54',  flag: '🇦🇷' },
  { iso2: 'CL', name: 'Chile',               dial: '56',  flag: '🇨🇱' },
  { iso2: 'AU', name: 'Australia',           dial: '61',  flag: '🇦🇺' },
  { iso2: 'NZ', name: 'New Zealand',         dial: '64',  flag: '🇳🇿' },
  { iso2: 'CN', name: 'China',               dial: '86',  flag: '🇨🇳' },
  { iso2: 'JP', name: 'Japan',               dial: '81',  flag: '🇯🇵' },
  { iso2: 'KR', name: 'South Korea',         dial: '82',  flag: '🇰🇷' },
  { iso2: 'PH', name: 'Philippines',         dial: '63',  flag: '🇵🇭' },
  { iso2: 'TH', name: 'Thailand',            dial: '66',  flag: '🇹🇭' },
  { iso2: 'VN', name: 'Vietnam',             dial: '84',  flag: '🇻🇳' },
];

export const DEFAULT_COUNTRY_ISO = 'SA';

export function findCountryByIso(iso2: string | undefined | null): Country | undefined {
  if (!iso2) return undefined;
  const up = iso2.toUpperCase();
  return COUNTRIES.find((c) => c.iso2 === up);
}
