/**
 * The signing key for every session token, and the one place it is read.
 *
 * The development fallback below is a literal in a public repository. Anything
 * signed with it can be forged by anyone who has read the source - including a
 * token claiming the admin or police role, which is enough to reach the
 * surveillance estate and the watchlist. Four call sites used to carry that
 * fallback inline, so a deployment missing JWT_SECRET authenticated against a
 * published secret and nothing said so.
 *
 * Production has no fallback: the server refuses to start without a real key
 * (see server.ts), and this throws if it is ever reached without one.
 */
export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.trim() !== '') return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is not set. Refusing to sign or verify tokens.');
  }

  return 'your-secret-key';
};
