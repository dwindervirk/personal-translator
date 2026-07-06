export class SarvamAuthError extends Error {
  name = "SarvamAuthError";
}

export class SarvamRateLimitError extends Error {
  name = "SarvamRateLimitError";
}

export class SarvamBalanceError extends Error {
  name = "SarvamBalanceError";
}

export function throwSarvamError(status: number, body: string): never {
  if (status === 401 || status === 403) {
    throw new SarvamAuthError("Your API key is invalid. Check the key in Settings.");
  }
  if (status === 429) {
    throw new SarvamRateLimitError("Rate limit exceeded. Please wait a moment and try again.");
  }
  if (status === 402 || body.toLowerCase().includes("balance") || body.toLowerCase().includes("credit")) {
    throw new SarvamBalanceError("Your Sarvam account has insufficient credits.");
  }
  throw new Error(`Sarvam API error (${status}): ${body}`);
}
