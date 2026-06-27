import { encrypt, decrypt } from '@/lib/whatsapp/encryption';
import { createHash } from 'crypto';

export function encryptSecret(secret: string | null | undefined): string | null {
  if (!secret) return null;
  return encrypt(secret);
}

export function decryptSecret(encryptedSecret: string | null | undefined): string {
  if (!encryptedSecret) return '';
  try {
    return decrypt(encryptedSecret);
  } catch {
    // Fallback to the raw string if decryption fails (e.g. key is already plain text)
    return encryptedSecret;
  }
}

/**
 * Resolves a stable external lead ID. If the provided ID is missing, empty,
 * or contains dynamic mock/fallback patterns (e.g. including timestamps like Date.now()),
 * it generates a stable MD5 hash based on platform, mobile, product name, and inquiry timestamp.
 */
export function getStableExternalLeadId(
  platform: string,
  externalLeadId: string | null | undefined,
  mobile: string | null | undefined,
  productName: string | null | undefined,
  inquiryAt: string | null | undefined
): string {
  const cleanedId = (externalLeadId || '').trim();

  // A lead ID is considered "unavailable/dynamic" if it is empty, or if it represents a dynamic mock
  const isUnavailable =
    !cleanedId ||
    /mock|fallback|hist|inc/i.test(cleanedId) ||
    (cleanedId.startsWith('EI-') && cleanedId.split('-').length > 2) ||
    (cleanedId.startsWith('TI-') && cleanedId.split('-').length > 2) ||
    (cleanedId.startsWith('IM-') && cleanedId.split('-').length > 2);

  if (isUnavailable) {
    const p = platform.toUpperCase().trim();
    const mob = (mobile || '').replace(/[^0-9+]/g, '').trim();
    const prod = (productName || '').toLowerCase().trim();

    // Normalize inquiryAt to an ISO timestamp or empty string
    let dateStr = '';
    if (inquiryAt) {
      const d = new Date(inquiryAt);
      if (!isNaN(d.getTime())) {
        dateStr = d.toISOString();
      }
    }

    const hashInput = `${p}:${mob}:${prod}:${dateStr}`;
    const hash = createHash('md5').update(hashInput).digest('hex');
    return `${p}-HASH-${hash}`;
  }

  return cleanedId;
}

