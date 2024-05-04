import { Suspense, useEffect, useState } from 'react';

import WordCard from './WordCard';

const CHUNK_SIZE = 12;

export default function LazyLoadingSearchResults({
  results,
  currentWord,
  className,
}: {
  results: SearchResult[];
  currentWord: string;
  className: string;
}) {
  const firstResults = results
    .slice(0, CHUNK_SIZE)
    .map((result) => <WordCard key={result.id} word={result.word} currentWord={currentWord} />);

  const [lazyLoaded, setLazyLoaded] = useState<JSX.Element[]>([]);

  useEffect(() => {
    if (
      firstResults.length + lazyLoaded.length !== results.length ||
      (results.length > CHUNK_SIZE && lazyLoaded.length === 0)
    ) {
      setTimeout(() => {
        setLazyLoaded(
          results
            .slice(CHUNK_SIZE, results.length)
            .map((result) => (
              <WordCard key={result.id} word={result.word} currentWord={currentWord} />
            )),
        );
      }, 100);
    }
  }, [results, currentWord, firstResults, lazyLoaded]);

  return (
    <div className={`${className} flex w-full flex-wrap items-start justify-center gap-4`}>
      {firstResults}
      <Suspense fallback={<p className="my-12">Cargando...</p>}>{lazyLoaded}</Suspense>
    </div>
  );
}
