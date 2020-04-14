import React, { useState } from 'react';
import accents from 'remove-accents';

import './App.scss';

import Search from './components/Search';
import Word from './components/Word';

import words from './data.json';

const Info = () => (
  <div className="info">
    <span>
      <a href="https://github.com/sjdonado" target="_blank" rel="noopener noreferrer">Juan Rodriguez</a>
      {' y '}
      <a href="https://github.com/jvalenciae" target="_blank" rel="noopener noreferrer">Javier Valencia</a>
    </span>
    <span>Universidad del Norte | 2020</span>
  </div>
);

const Title = () => (
  <>
    <span className="glyphicon glyphicon-book" style={{ fontSize: '50px' }} />
    <h1 className="title">Costeñol - Diccionario</h1>
  </>
);

function App() {
  const [filteredWords, setFilteredWords] = useState(words);
  const [currentWord, setCurrentWord] = useState('');

  const handleUpdate = (word) => {
    const parsedWord = accents.remove(word).toLowerCase();
    setFilteredWords(words.filter(({ text }) => {
      const parsedText = text.toLocaleLowerCase();
      return parsedText.includes(parsedWord) || parsedText.includes(word.toLowerCase());
    }));
    setCurrentWord(word);
  };

  return (
    <div className="body-top-highlight">
      <Info />
      <div className="navigation-wrapper">
        <Title />
        <Search
          word={currentWord}
          onUpdateWord={handleUpdate}
        />
        <span>
          {`Número total de palabras encontradas: ${filteredWords.length}`}
        </span>
      </div>
      <div className="content-wrapper">
        {filteredWords.map((word) => (
          <Word
            key={word.text}
            word={word}
            currentWord={currentWord}
          />
        ))}
      </div>
    </div>
  );
}

export default App;
