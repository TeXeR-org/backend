import type { ConfigService } from '@nestjs/config';

/**
 * Whether paid plans are on sale. Off unless `BILLING_PLANS_ACTIVE` is exactly "true", so a server that forgets the variable sells nothing and charges nobody: checkout, restarting a canceled plan, and the local stand-in for Stripe are all closed, while people who already pay can still see and cancel what they have. A production server also refuses to sell with Stripe's test keys, since anyone could pay with a test card and get a plan for nothing.
 */
export function plansActive(config: ConfigService): boolean {
  if (config.get<string>('BILLING_PLANS_ACTIVE')?.trim().toLowerCase() !== 'true') return false;
  if (config.get<string>('NODE_ENV') === 'production' && isTestKey(config.get<string>('STRIPE_SECRET_KEY'))) return false;
  return true;
}

/** A Stripe test-mode key (secret or restricted). */
export function isTestKey(key: string | undefined): boolean {
  return !!key && /^(sk|rk)_test_/.test(key.trim());
}

/** What someone is told when they try to buy while plans are paused. */
export const PLANS_PAUSED =
  'Paid plans are not available yet. We are finishing the setup of payments; until then everything on the Free plan works as usual, and nothing is charged.';
