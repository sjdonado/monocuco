import { useRef, useEffect } from 'react';

interface Props {
  onUpdateWord: (value: string) => void;
  word: string;
}

export default function Input({ onUpdateWord, word }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef && inputRef.current) {
      inputRef.current.focus();
    }
  });

  return (
    <input
      ref={inputRef}
      id="search-input"
      className="w-full h-20 border border-gray-400 border-r-0 rounded-none appearance-none text-2xl text-left px-7 outline-none leading-9"
      type="text"
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      onChange={(e) => onUpdateWord(e.target.value)}
      value={word}
    />
  );
}
