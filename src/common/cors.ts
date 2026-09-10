/**
 * Monta o callback de origem para o CORS.
 *
 * - `CORS_ORIGINS` aceita origens exatas e curingas com `*`
 *   (ex.: `https://*.vercel.app`).
 * - Origens de desenvolvimento local e do Capacitor/Ionic no device são
 *   SEMPRE permitidas, não precisam estar na env.
 * - Requisições sem `Origin` (curl, server-to-server, same-origin) passam.
 */
const ALWAYS_ALLOWED: RegExp[] = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https?:\/\/\[::1\](:\d+)?$/,
  /^capacitor:\/\/localhost$/,
  /^ionic:\/\/localhost$/,
];

function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .trim()
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^/]*');
  return new RegExp(`^${escaped}$`);
}

export function buildCorsOrigin(
  patterns: string[],
): (
  origin: string | undefined,
  cb: (err: Error | null, allow: boolean) => void,
) => void {
  const allowed = [
    ...ALWAYS_ALLOWED,
    ...patterns.filter(Boolean).map(patternToRegExp),
  ];
  return (origin, cb) => {
    if (!origin) return cb(null, true);
    cb(null, allowed.some((re) => re.test(origin)));
  };
}
