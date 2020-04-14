import React, { useState } from 'react';
import './App.scss';

import Search from './components/Search';
import Word from './components/Word';

import words from './data.json';

const Title = () => (
  <>
    <span className="glyphicon glyphicon-book" style={{ fontSize: '50px' }} />
    <h1 className="navigation-index-link__header--column">Costeñol - Diccionario</h1>
  </>
);

function App() {
  const [filteredWords, setFilteredWords] = useState(words);
  const [currentWord, setCurrentWord] = useState('');

  return (
    <div className="body-top-highlight">
      <div className="navigation-wrapper--column">
        <Title />
        <Search
          word={currentWord}
          onUpdateWord={setCurrentWord}
          onSubmitWord={(word) => console.log('word', word)}
        />
      </div>
      <div className="content-wrapper">
        {filteredWords.map((word) => (
          <Word key={word.title} word={word} />
        ))}
      </div>
    </div>
  );
}

export default App;
