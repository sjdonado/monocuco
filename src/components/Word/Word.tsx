import React from 'react';
import Highlighter from 'react-highlight-words';

import './Word.scss';

interface Props {
  word: Word;
  currentWord: string;
}

const Word = function Word({
  word,
  currentWord,
}: Props) {
  const authors = word.authors.map(({ name }) => name).join(', ');
  const synonyms = word.synonyms.join(', ');

  const searchWords = currentWord.split(' ');
  const mainWords = searchWords.filter((text) => text.length > 2);
  if (searchWords.length > mainWords.length) {
    mainWords.push(currentWord);
  }

  const highlightText = (text: string, key?: string) => (
    <Highlighter
      key={key}
      highlightClassName="highlight"
      searchWords={mainWords}
      autoEscape
      textToHighlight={text}
    />
  );

  return (
    <div className="word-container">
      {highlightText(word.text)}
      <div className="underline" />
      <h6>{word.meaning}</h6>
      {synonyms.length > 0 && (
        <div className="synonyms-list">
          <span className="list-title">Sinónimos</span>
          {highlightText(synonyms)}
        </div>
      )}
      <div className="examples-list">
        <span className="list-title">Ejemplos</span>
        {word.examples.map((example) => highlightText(example, example))}
      </div>
      <div className="credits">
        <span>Añadida por: </span>
        {word.authors.map(({ link }) => (
          <a
            key={`${word.text}-${link}`}
            href={link}
            target="_blank"
            rel="noopener noreferrer"
          >
            {authors}
          </a>
        ))}
      </div>
    </div>
  );
};

export default Word;
