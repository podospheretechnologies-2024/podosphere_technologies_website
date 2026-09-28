import 'server-only';

export class ProviderError extends Error {
  constructor(
    public readonly identifier: string,
    message: string,
    public readonly body?: string
  ) {
    super(message);
    this.name = new.target.name;
  }
}

// The access token expired or was revoked; a refresh (or reconnect) is needed.
export class RefreshTokenError extends ProviderError {}

// The platform rejected the request content; retrying will not help.
export class BadBodyError extends ProviderError {}

// The channel lost access permanently (app removed, account banned, ...).
export class DisconnectError extends ProviderError {}

// The user did not grant every permission the provider requires.
export class NotEnoughScopesError extends ProviderError {}
