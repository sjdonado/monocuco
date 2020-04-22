import React, { useState } from 'react';
import accents from 'remove-accents';

import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

import './App.scss';

import Search from './components/Search/Search';
import Word from './components/Word/Word';

import icon from './icon.jpg';
import bmcImg from './bmc-button.png';
import words from './data.json';

const Info = () => (
  <div className="info">
    <div className="github-buttons-wrapper">
      <a className="github-button" href="https://github.com/sjdonado/monocuco/fork" data-icon="octicon-repo-forked" data-size="large" data-show-count="true" aria-label="Fork sjdonado/monocuco on GitHub">Fork</a>
      <a className="github-button" href="https://github.com/sjdonado/monocuco" data-icon="octicon-star" data-size="large" data-show-count="true" aria-label="Star sjdonado/monocuco on GitHub">Star</a>
    </div>
    <a href="https://github.com/sjdonado/monocuco/blob/master/README.md" target="_blank" rel="noopener noreferrer">¿Quieres añadir una palabra? Click aquí</a>
    <a href="https://www.buymeacoffee.com/Oyh2K6P" target="_blank" rel="noopener noreferrer">
      <img src={bmcImg} width="110" alt="Comprame un café" />
    </a>
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
      <h4>Diccionario de palabras y frases costeñas</h4>
    </div>
  </>
);

function App() {
  const [filteredWords, setFilteredWords] = useState(words);
  const [currentWord, setCurrentWord] = useState('');

  const handleUpdate = (word) => {
    setCurrentWord(word);
    const parsedWord = accents.remove(word).toLowerCase();
    let newFilteredWords = words.filter(({ text }) => {
      const parsedText = accents.remove(text).toLocaleLowerCase();
      return parsedText.includes(parsedWord);
    });
    // Otherwise search by examples
    if (newFilteredWords.length === 0) {
      newFilteredWords = words.filter(({ examples }) => {
        const parsedText = accents.remove(examples.join(',')).toLocaleLowerCase();
        return parsedText.includes(parsedWord);
      });
    }
    setFilteredWords(newFilteredWords);
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
