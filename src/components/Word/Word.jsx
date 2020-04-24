import React from 'react';
import PropTypes from 'prop-types';
import Highlighter from 'react-highlight-words';
import accents from 'remove-accents';

import './Word.scss';

function Word({ word, currentWord }) {
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
        <a href={word.author.link} target="_blank" rel="noopener noreferrer">
          {word.author.name}
        </a>
      </div>
    </div>
  );
}

Word.propTypes = {
  word: PropTypes.shape({
    text: PropTypes.string.isRequired,
    meaning: PropTypes.string.isRequired,
    synonyms: PropTypes.arrayOf(PropTypes.string).isRequired,
    examples: PropTypes.arrayOf(PropTypes.string).isRequired,
    author: PropTypes.shape({
      link: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    }),
  }).isRequired,
  currentWord: PropTypes.string,
};

Word.defaultProps = {
  currentWord: null,
};

export default Word;
