import { useState } from 'react';

import '@fortawesome/fontawesome-free/css/all.min.css';
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
    <div className="flex min-h-screen w-full flex-col justify-between gap-12 border-t-4 border-red-600 p-4">
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
          <div className="flex w-full flex-wrap items-center justify-center">
            <div className="text-red-600" role="status">
              <span className="sr-only">Cargando...</span>
            </div>
          </div>
        }
      >
        <div className="flex w-full flex-wrap items-start justify-center gap-4">
          {results.map((word) => (
            <WordCard key={word.text} word={word} currentWord={currentWord} />
          ))}
        </div>
      </InfiniteScroll>
      {emptyResults && isSearchBaring && (
        <div className="m-[24px_auto] flex w-full flex-wrap items-center justify-center">
          <p className="font-bold">No se han encontrado resultados 🙁</p>
        </div>
      )}
    </div>
  );
};

export default App;
