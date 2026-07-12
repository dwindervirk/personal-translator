import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  setSourceLanguage,
  setTargetLanguage,
} from "@/store/translatorSlice";
import { INDIAN_LANGUAGES } from "@/lib/languages";

interface Props {
  type: "source" | "target";
}

export function LanguageSelect({ type }: Props) {
  const dispatch = useAppDispatch();
  const { sourceLanguage, targetLanguage } = useAppSelector(
    (state) => state.translator
  );
  const value = type === "source" ? sourceLanguage : targetLanguage;
  const languages = INDIAN_LANGUAGES;

  const onChange = (code: string) => {
    if (type === "source") {
      dispatch(setSourceLanguage(code));
    } else {
      dispatch(setTargetLanguage(code));
    }
  };

  const sourceLanguages = languages;
  const targetLanguages = languages.filter((l) => l.code !== "unknown");

  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">
        {type === "source" ? "From" : "To"}
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-lg border border-border bg-surface px-3 py-2.5 pr-8 text-sm text-ink transition-colors duration-150 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
        >
          {(type === "source" ? sourceLanguages : targetLanguages).map((lang) => (
            <option key={lang.code} value={lang.code} className="bg-surface text-ink">
              {lang.label}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>
    </div>
  );
}
