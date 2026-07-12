function sortByLabel(arr: { code: string; label: string }[]) {
  const [first, ...rest] = arr;
  const sorted = [...rest].sort((a, b) => a.label.localeCompare(b.label));
  return first.code === "unknown" ? [first, ...sorted] : sorted;
}

export const INDIAN_LANGUAGES = sortByLabel([
  { code: "unknown", label: "Auto-detect" },
  { code: "as-IN", label: "Assamese" },
  { code: "bn-IN", label: "Bengali" },
  { code: "en-IN", label: "English" },
  { code: "gu-IN", label: "Gujarati" },
  { code: "hi-IN", label: "Hindi" },
  { code: "kn-IN", label: "Kannada" },
  { code: "ml-IN", label: "Malayalam" },
  { code: "mr-IN", label: "Marathi" },
  { code: "or-IN", label: "Odia" },
  { code: "pa-IN", label: "Punjabi" },
  { code: "ta-IN", label: "Tamil" },
  { code: "te-IN", label: "Telugu" },
]);

