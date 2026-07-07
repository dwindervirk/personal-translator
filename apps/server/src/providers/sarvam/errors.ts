import { ProviderAuthError, ProviderRateLimitError, ProviderBalanceError } from "../errors";
export { ProviderAuthError as SarvamAuthError, ProviderRateLimitError as SarvamRateLimitError, ProviderBalanceError as SarvamBalanceError };

export function throwSarvamError(status: number, body: string): never {
  if (status === 401 || status === 403) {
    throw new ProviderAuthError("Your API key is invalid. Check the key in Settings.");
  }
  if (status === 429) {
    throw new ProviderRateLimitError("Rate limit exceeded. Please wait a moment and try again.");
  }
  if (status === 402 || body.toLowerCase().includes("balance") || body.toLowerCase().includes("credit")) {
    throw new ProviderBalanceError("Your Sarvam account has insufficient credits.");
  }
  throw new Error(`Sarvam API error (${status}): ${body}`);
}
