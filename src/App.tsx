import { useState } from 'react';

import GithubButtons from './components/GithubButtons';
import Header from './components/Header';
import SearchBar from './components/SearchBar';
import LazyLoadingSearchResults from './components/LazyLoadingSearchResults';

import { search, initSearchResults } from './services/search';

const App = function App() {
  const [results, setResults] = useState<SearchResult[]>(initSearchResults);
  const [currentWord, setCurrentWord] = useState<string>('');
  const [searchTimeout, setSearchBarTimeout] = useState<NodeJS.Timeout>();

  const handleUpdate = (word: string): void => {
    setCurrentWord(word);

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (!word) {
      setResults(initSearchResults);
      return;
    }

    setSearchBarTimeout(
      setTimeout(() => {
        const newresults = search(word);
        setResults(newresults);
      }, 100),
    );
  };

  const isSearchBaring = currentWord.length > 0;
  const emptyResults = results.length === 0;

  return (
    <div className="flex min-h-screen w-full flex-col justify-start gap-12 border-t-4 border-red-600 p-4">
      <GithubButtons />
      <div className="flex flex-col items-center">
        <Header />
        <SearchBar
          word={currentWord}
          onSearch={handleUpdate}
          totalWords={initSearchResults.length}
          resultStats={results.length}
        />
      </div>
      <LazyLoadingSearchResults className="flex-1" results={results} currentWord={currentWord} />
      {emptyResults && isSearchBaring && (
        <div className="flex w-full flex-1 flex-wrap items-center justify-center">
          <p className="font-semibold">No se han encontrado resultados 🙁</p>
        </div>
      )}
      <footer className="mt-12 flex justify-center gap-1 text-sm">
        <p>Hecho con ❤️ por</p>
        <a href="https://sjdonado.github.io" target="_blank" rel="noreferrer" className="underline">
          @sjdonado
        </a>
      </footer>
    </div>
  );
};

export default App;
