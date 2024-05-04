import { useRef, useEffect } from 'react';

interface Props {
  word: string;
  onSearch: (word: string) => void;
  totalWords: number;
  resultStats: number;
}

export default function SearchBar({ word, onSearch, totalWords, resultStats }: Props) {
  return (
    <div className="mx-auto mt-10 flex w-[480px] flex-col gap-1 sm:w-9/12">
      <Input onSearch={onSearch} word={word} />
      <span className="text-gray-500">{`Resultados búsqueda: ${resultStats} de ${totalWords}`}</span>
    </div>
  );
}

function Input({ onSearch, word }: { onSearch: (value: string) => void; word: string }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef && inputRef.current) {
      inputRef.current.focus();
    }
  });

  return (
    <div className="flex items-center justify-center">
      <input
        ref={inputRef}
        type="text"
        className="h-12 w-full appearance-none rounded-lg rounded-r-none border border-r-0 border-gray-400 px-4 leading-9 outline-none"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Buscar palabra"
        value={word}
      />
      <div className="flex h-12 items-center justify-center rounded-r-lg border border-l-0 border-gray-400">
        <i className="fas fa-search mr-4 text-2xl text-gray-400" />
      </div>
    </div>
  );
}
