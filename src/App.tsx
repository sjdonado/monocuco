import React, { useState } from 'react';

import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import InfiniteScroll from 'react-infinite-scroll-component';

import './App.scss';

import Search from './components/Search/Search';
import Word from './components/Word/Word';
import GithubButtons from './components/GithubButtons/GithubButtons';
import Header from './components/Header/Header';

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

    setSearchTimeout(setTimeout(() => {
      const newresults = search(word);
      setResults(newresults);
    }, 300));
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
    <div className="body-top-highlight">
      <GithubButtons />
      <div className="navigation-wrapper">
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
        loader={(
          <div className="content-wrapper">
            <div className="spinner-border text-primary" role="status">
              <span className="sr-only">Cargando...</span>
            </div>
          </div>
        )}
        endMessage={!isSearching && (
          <div className="content-wrapper">
            <p className="font-weight-bold">
              Has llegado al final, no es mucho pero es trabajo honesto 🥲
            </p>
          </div>
        )}
      >
        <div className="content-wrapper">
          {
            results.map((word) => (
              <Word
                key={word.text}
                word={word}
                currentWord={currentWord}
              />
            ))
          }
        </div>
      </InfiniteScroll>
      {emptyResults && isSearching && (
        <div className="content-wrapper">
          <p className="font-weight-bold">No se han encontrado resultados 🙁</p>
        </div>
      )}
    </div>
  );
};

export default App;
