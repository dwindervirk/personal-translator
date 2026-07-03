
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  setSourceLanguage,
  setTargetLanguage,
} from "@/store/translatorSlice";
import { LANGUAGES } from "@/lib/languages";

interface Props {
  type: "source" | "target";
}

export function LanguageSelect({ type }: Props) {
  const dispatch = useAppDispatch();
  const value = useAppSelector((state) =>
    type === "source"
      ? state.translator.sourceLanguage
      : state.translator.targetLanguage
  );

  const onChange = (code: string) => {
    if (type === "source") {
      dispatch(setSourceLanguage(code));
    } else {
      dispatch(setTargetLanguage(code));
    }
  };

  const sourceLanguages = LANGUAGES;
  const targetLanguages = LANGUAGES.filter((l) => l.code !== "unknown");

  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-gray-400">
        {type === "source" ? "From" : "To"}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-32 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-emerald-500 focus:outline-none"
      >
        {(type === "source" ? sourceLanguages : targetLanguages).map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </label>
  );
}

