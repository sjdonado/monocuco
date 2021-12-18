import React from 'react';
import Highlighter from 'react-highlight-words';
import accents from 'remove-accents';

import './Word.scss';

interface Props {
  word: Word;
  currentWord: string;
}

const Word: React.FC<Props> = function Word({
  word,
  currentWord,
}) {
  return (
    <div className="word-container">
      <Highlighter
        highlightClassName="highlight"
        searchWords={[currentWord, accents.remove(currentWord)]}
        autoEscape
        textToHighlight={word.text}
      />
      <div className="underline" />
      <h6>{word.meaning}</h6>
      {word.synonyms.length > 0 ? (
        <div className="synonyms-list">
          <span className="list-title">Sinónimos</span>
          <Highlighter
            highlightClassName="highlight"
            searchWords={[currentWord, accents.remove(currentWord)]}
            autoEscape
            textToHighlight={word.synonyms.join(', ')}
          />
        </div>
      ) : null}
      <div className="examples-list">
        <span className="list-title">Ejemplos</span>
        {word.examples.map((example) => (
          <Highlighter
            key={example}
            highlightClassName="highlight"
            searchWords={[currentWord, accents.remove(currentWord)]}
            autoEscape
            textToHighlight={example}
          />
        ))}
      </div>
      <div className="credits">
        <span>Añadida por: </span>
        {word.authors.map(({ name, link }, idx) => {
          let parsedName = name;
          if (idx < word.authors.length - 1) {
            parsedName += ', ';
          }
          return (
            <a key={`${word.text}-${link}`} href={link} target="_blank" rel="noopener noreferrer">
              {parsedName}
            </a>
          );
        })}
      </div>
    </div>
  );
};

export default Word;
