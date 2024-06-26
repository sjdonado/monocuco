import { useRef, useEffect } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface Props {
  word: string;
  onSearch: (word: string) => void;
  totalWords: number;
  resultStats: number;
}

export default function SearchBar({ word, onSearch, totalWords, resultStats }: Props) {
  return (
    <div className="mx-auto mt-10 flex w-full flex-col gap-1 lg:w-2/3 xl:w-1/2">
      <Input onSearch={onSearch} word={word} />
      <span className="text-sm text-gray-500">{`Resultados búsqueda: ${resultStats} de ${totalWords}`}</span>
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
        className="h-12 w-full appearance-none rounded-lg rounded-r-none border border-r-0 border-gray-400 px-4 leading-9 outline-none dark:border-gray-700 dark:bg-gray-900"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Buscar palabra"
        value={word}
      />
      <div className="flex h-12 items-center justify-center rounded-r-lg border border-l-0 border-gray-400 bg-white dark:border-gray-700 dark:bg-gray-900">
        <MagnifyingGlassIcon className="mr-4 w-5 text-gray-400" />
      </div>
    </div>
  );
}
