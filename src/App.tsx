import React, { useState } from 'react';
import accents from 'remove-accents';

import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

import './App.scss';

import Search from './components/Search/Search';
import Word from './components/Word/Word';
import GithubButtons from './components/GithubButtons/GithubButtons';
import Header from './components/Header/Header';

import words from './data.json';

const App: React.FC = function App() {
  const [filteredWords, setFilteredWords] = useState<Word[]>(words);
  const [currentWord, setCurrentWord] = useState<string>('');
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout>();

  const handleUpdate = (word: string): void => {
    setCurrentWord(word);
    const parsedWord = accents.remove(word).toLowerCase();

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    setSearchTimeout(setTimeout(() => {
      let newFilteredWords = words.filter(({ text, synonyms }) => {
        const parsedText = accents.remove(text).toLocaleLowerCase();
        const parsedSynonyms = accents.remove(synonyms.join(',')).toLocaleLowerCase();
        return parsedText.includes(parsedWord) || parsedSynonyms.includes(parsedWord);
      });

      // Otherwise search by examples
      if (newFilteredWords.length === 0) {
        newFilteredWords = words.filter(({ examples }) => {
          const parsedExamples = accents.remove(examples.join(',')).toLocaleLowerCase();
          return parsedExamples.includes(parsedWord);
        });
      }

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
          totalWords={words.length}
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
