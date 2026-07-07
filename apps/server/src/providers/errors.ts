export class ProviderAuthError extends Error {
  name = "ProviderAuthError";
}

export class ProviderRateLimitError extends Error {
  name = "ProviderRateLimitError";
}

export class ProviderBalanceError extends Error {
  name = "ProviderBalanceError";
}