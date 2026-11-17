/**
 * Global failure ceiling for the admin sign-in (PT-03). Pure, with an injectable clock, so it is unit-tested
 * directly (tests/unit/admin-throttle.test.mjs).
 *
 * The old design counted EVERY attempt from EVERYONE and refused all sign-ins once 60 had been made in ten
 * minutes. That bounded password guessing, but it also let any stranger send six bad logins a minute and keep
 * the real owner out for as long as they liked.
 *
 * What changed:
 *  - only FAILED attempts count (an owner who signs in correctly never uses up the budget), and
 *  - the ceiling is applied to unrecognised browsers only (see isKnownAdminDevice in lib/auth.ts): the owner's
 *    own, already-trusted browser is never held back by other people's failures.
 * Guessing stays bounded: no matter how many addresses an attacker uses, they get at most `limit` wrong
 * guesses per window, because they never hold a trusted-device cookie.
 */
export type FailureCeiling = {
  /** True while `limit` or more failures happened inside the window. Does not change any state. */
  blocked(): boolean;
  /** Records one failed attempt. Returns true exactly when the owner should be alerted (ceiling reached, and not alerted recently). */
  failure(): boolean;
  /** Failures currently inside the window (for tests and diagnostics). */
  count(): number;
};

export function createFailureCeiling(opts: { limit: number; windowMs: number; alertCooldownMs?: number; now?: () => number }): FailureCeiling {
  const { limit, windowMs } = opts;
  const cooldown = opts.alertCooldownMs ?? 30 * 60_000;
  const now = opts.now ?? Date.now;
  let hits: number[] = [];
  let lastAlert = -Infinity;

  const prune = () => {
    const t = now();
    hits = hits.filter((x) => t - x < windowMs);
  };

  return {
    blocked() {
      prune();
      return hits.length >= limit;
    },
    failure() {
      prune();
      hits.push(now());
      // Bounded memory even if something keeps reporting failures while blocked.
      if (hits.length > limit * 2) hits = hits.slice(-limit * 2);
      if (hits.length >= limit && now() - lastAlert >= cooldown) {
        lastAlert = now();
        return true;
      }
      return false;
    },
    count() {
      prune();
      return hits.length;
    },
  };
}
