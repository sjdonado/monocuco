import React, { useState } from 'react';
import accents from 'remove-accents';

import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

import './App.scss';

import Search from './components/Search';
import Word from './components/Word';

import icon from './icon.jpg';
import words from './data.json';

const Info = () => (
  <div className="info">
    <span>
      Hecho por:
      {' '}
      <a href="https://github.com/sjdonado" target="_blank" rel="noopener noreferrer">Juan Rodriguez</a>
    </span>
    <a href="https://github.com/sjdonado/monocuco/blob/master/README.md" target="_blank" rel="noopener noreferrer">¿Quieres añadir una palabra? Click aquí</a>
  </div>
);

const Title = () => (
  <>
    <img
      className="icon"
      src={icon}
      alt="Bailarina - Carnaval de Barranquilla, Colombia | Ilustración Andrés Urquina Sánchez"
    />
    <div className="title">
      <h1>Monocuco</h1>
      <h4>Diccionario de palabras costeñas</h4>
    </div>
  </>
);

function App() {
  words.sort((a, b) => a.text.localeCompare(b.text));
  const [filteredWords, setFilteredWords] = useState(words);
  const [currentWord, setCurrentWord] = useState('');

  const handleUpdate = (word) => {
    const parsedWord = accents.remove(word).toLowerCase();
    setFilteredWords(words.filter(({ text }) => {
      const parsedText = accents.remove(text).toLocaleLowerCase();
      return parsedText.includes(parsedWord);
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
