declare module 'passport-apple' {
  import { Strategy as PassportStrategy } from 'passport';

  export interface Profile {
    id: string;
    emails?: Array<{ value: string }>;
    name?: { firstName?: string; lastName?: string };
    photos?: Array<{ value: string }>;
  }

  export type VerifyCallback = (err: Error | null, user?: unknown) => void;

  export interface AppleStrategyOptions {
    clientID: string;
    teamID: string;
    keyID: string;
    privateKeyString: string;
    callbackURL: string;
    scope?: string[];
    passReqToCallback?: boolean;
  }

  export class Strategy extends PassportStrategy {
    constructor(options: AppleStrategyOptions, verify: Function);
    authenticate(req: unknown, options?: unknown): void;
  }
}
