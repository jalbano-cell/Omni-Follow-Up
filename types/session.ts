export interface SessionPayload {
  businessId: string;
  email: string;
  /** The business's session_token_version at issue time; lib/session.ts rejects the token if the business's current version has moved past it (revocation). Optional for backward compatibility with pre-revocation tokens, which are treated as version 0. */
  tokenVersion?: number;
}
