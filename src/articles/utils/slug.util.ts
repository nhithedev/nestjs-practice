import { randomBytes } from 'crypto';

const SLUG_SUFFIX_BYTES = 4; // -> 8 ký tự hex, đủ tránh trùng cho scope app này
const NON_ALPHANUMERIC_REGEX = /[^a-z0-9]+/g;
const EDGE_DASH_REGEX = /^-+|-+$/g;

export function buildArticleSlug(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // bỏ dấu tiếng Việt
    .replace(NON_ALPHANUMERIC_REGEX, '-')
    .replace(EDGE_DASH_REGEX, '');

  const suffix = randomBytes(SLUG_SUFFIX_BYTES).toString('hex');

  return `${base}-${suffix}`;
}
