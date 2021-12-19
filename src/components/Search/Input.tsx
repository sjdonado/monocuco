import React, { useRef, useEffect } from 'react';

interface Props {
  onUpdateWord: (value: string) => void,
  word: string,
}

const Input = function Input({
  onUpdateWord,
  word,
}: Props) {
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
      className="search__input"
      type="text"
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      onChange={(e) => onUpdateWord(e.target.value)}
      value={word}
    />
  );
};

export default Input;
