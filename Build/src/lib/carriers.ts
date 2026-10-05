export interface Carrier {
  name: string;
  code: number;
  patterns: RegExp[];
  hint: string;
}

export const CARRIERS: Carrier[] = [
  {
    name: 'UPS',
    code: 100003,
    patterns: [/^1Z[0-9A-Z]{16}$/i, /^T\d{10}$/, /^01Z\d{16}$/],
    hint: 'Starts with 1Z',
  },
  {
    name: 'FedEx',
    code: 100002,
    patterns: [/^\d{12}$/, /^\d{15}$/, /^\d{20}$/, /^\d{22}$/],
    hint: '12, 15, 20 or 22 digits',
  },
  {
    name: 'USPS',
    code: 21051,
    patterns: [/^\d{22}$/, /^[0-9]{13}$/, /^J\d{18}$/],
    hint: '22 digits',
  },
  {
    name: 'DHL',
    code: 100001,
    patterns: [/^\d{10}$/, /^JD\d{18}$/, /^\d{20}$/],
    hint: '10 digits',
  },
  {
    name: 'Amazon Logistics',
    code: 190271,
    patterns: [/^TBA\d{12}$/, /^TBC\d{12}$/, /^TBA[A-Z0-9]{16}$/],
    hint: 'Starts with TBA',
  },
];

export const OTHER_CARRIER = 'Other';

export function detectCarrier(trackingNumber: string): Carrier | null {
  const value = trackingNumber.trim();
  const matches = CARRIERS.filter((c) => c.patterns.some((p) => p.test(value)));

  if (matches.length !== 1) return null;

  return matches[0];
}

export function carrierCode(name: string): number | undefined {
  return CARRIERS.find((c) => c.name === name)?.code;
}

export function normalizeTrackingNumber(value: string): string {
  return value.trim().replace(/\s+/g, '').toUpperCase();
}
