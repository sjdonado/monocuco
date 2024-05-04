import { useState } from 'react';

import '@fortawesome/fontawesome-free/css/all.min.css';
import InfiniteScroll from 'react-infinite-scroll-component';

import Search from './components/Search';
import Word from './components/Word';
import GithubButtons from './components/GithubButtons';
import Header from './components/Header';

import { search, TOTAL_WORDS, searchPaginator } from './services/search';

const App = function App() {
  const [results, setResults] = useState<Word[]>(searchPaginator.firstResults);
  const [currentWord, setCurrentWord] = useState<string>('');
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout>();

  const handleUpdate = (word: string): void => {
    setCurrentWord(word);

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (!word) {
      setResults(searchPaginator.firstResults);
      return;
    }

    setSearchTimeout(
      setTimeout(() => {
        const newresults = search(word);
        setResults(newresults);
      }, 300),
    );
  };

  const isSearching = currentWord.length > 0;
  const emptyResults = results.length === 0;

  const fetch = () => {
    if (isSearching) {
      return;
    }
    setTimeout(() => {
      const data = searchPaginator.fetch(results.length);
      setResults(data);
    }, 300);
  };

  return (
    <div className="body-top-highlight border-t-5 border-red-600 w-full min-h-screen flex flex-col justify-between">
      <GithubButtons />
      <div className="navigation-wrapper flex flex-col justify-end items-center mt-12">
        <Header />
        <Search
          word={currentWord}
          onUpdateWord={handleUpdate}
          totalWords={TOTAL_WORDS}
          resultStats={results.length}
        />
      </div>
      <InfiniteScroll
        dataLength={results.length}
        next={fetch}
        hasMore={!isSearching && results.length < TOTAL_WORDS}
        loader={
          <div className="content-wrapper w-full flex flex-wrap justify-center items-center m-[24px_auto]">
            <div className="spinner-border text-red-600" role="status">
              <span className="sr-only">Cargando...</span>
            </div>
          </div>
        }
        endMessage={
          !isSearching && (
            <div className="content-wrapper w-full flex flex-wrap justify-center items-center m-[24px_auto]">
              <p className="font-bold">
                Has llegado al final, no es mucho pero es trabajo honesto 🥲
              </p>
            </div>
          )
        }
      >
        <div className="content-wrapper w-full flex flex-wrap justify-center items-center m-[24px_auto]">
          {results.map((word) => (
            <Word key={word.text} word={word} currentWord={currentWord} />
          ))}
        </div>
      </InfiniteScroll>
      {emptyResults && isSearching && (
        <div className="content-wrapper w-full flex flex-wrap justify-center items-center m-[24px_auto]">
          <p className="font-bold">No se han encontrado resultados 🙁</p>
        </div>
      )}
    </div>
  );
};

export default App;
