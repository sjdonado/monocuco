import { useState } from 'react';

import InfiniteScroll from 'react-infinite-scroll-component';

import SearchBar from './components/SearchBar';
import WordCard from './components/WordCard';
import GithubButtons from './components/GithubButtons';
import Header from './components/Header';

import { search, TOTAL_WORDS, searchPaginator } from './services/search';

const App = function App() {
  const [results, setResults] = useState<Word[]>(searchPaginator.firstResults);
  const [currentWord, setCurrentWord] = useState<string>('');
  const [searchTimeout, setSearchBarTimeout] = useState<NodeJS.Timeout>();

  const handleUpdate = (word: string): void => {
    setCurrentWord(word);

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (!word) {
      setResults(searchPaginator.firstResults);
      return;
    }

    setSearchBarTimeout(
      setTimeout(() => {
        const newresults = search(word);
        setResults(newresults);
      }, 300),
    );
  };

  const isSearchBaring = currentWord.length > 0;
  const emptyResults = results.length === 0;

  const fetch = () => {
    if (isSearchBaring) {
      return;
    }
    setTimeout(() => {
      const data = searchPaginator.fetch(results.length);
      setResults(data);
    }, 300);
  };

  return (
    <div className="flex min-h-screen w-full flex-col justify-start gap-12 border-t-4 border-red-600 p-4">
      <GithubButtons />
      <div className="flex flex-col items-center">
        <Header />
        <SearchBar
          word={currentWord}
          onSearch={handleUpdate}
          totalWords={TOTAL_WORDS}
          resultStats={results.length}
        />
      </div>
      <InfiniteScroll
        dataLength={results.length}
        next={fetch}
        hasMore={!isSearchBaring && results.length < TOTAL_WORDS}
        loader={
          <div className="my-24 flex w-full justify-center transition-opacity">
            <div className="relative flex size-12">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75"></span>
              <span className="sr-only">Cargando...</span>
            </div>
          </div>
        }
        endMessage={
          <footer className="mt-12 flex justify-center gap-1 text-sm">
            <p>Hecho con ❤️ por</p>
            <a
              href="https://sjdonado.github.io"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              @sjdonado
            </a>
          </footer>
        }
      >
        <div className="flex w-full flex-wrap items-start justify-center gap-4">
          {results.map((word) => (
            <WordCard key={word.text} word={word} currentWord={currentWord} />
          ))}
        </div>
      </InfiniteScroll>
      {emptyResults && isSearchBaring && (
        <div className="flex w-full flex-wrap items-center justify-center">
          <p className="font-semibold">No se han encontrado resultados 🙁</p>
        </div>
      )}
    </div>
  );
};

export default App;
