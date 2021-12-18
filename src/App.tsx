import React, { useState } from 'react';

import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

import './App.scss';

import Search from './components/Search/Search';
import Word from './components/Word/Word';
import GithubButtons from './components/GithubButtons/GithubButtons';
import Header from './components/Header/Header';
import { search, TOTAL_WORDS, FIRST_WORDS } from './services/search';

const App: React.FC = function App() {
  const [filteredWords, setFilteredWords] = useState<Word[]>(FIRST_WORDS);
  const [currentWord, setCurrentWord] = useState<string>('');
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout>();

  const handleUpdate = (word: string): void => {
    setCurrentWord(word);

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (!word) {
      setFilteredWords(FIRST_WORDS);
      return;
    }

    setSearchTimeout(setTimeout(() => {
      const newFilteredWords = search(word);
      setFilteredWords(newFilteredWords);
    }, 300));
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
          resultStats={filteredWords.length}
        />
      </div>
      <div className="content-wrapper">
        {
          filteredWords.map((word) => (
            <Word
              key={word.text}
              word={word}
              currentWord={currentWord}
            />
          ))
        }
      </div>
    </div>
  );
};

export default App;
