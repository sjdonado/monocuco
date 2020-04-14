import React from 'react';
import PropTypes from 'prop-types';

function Word({ word }) {
  return (
    <div className="wod-view-wrapper">
      <h2>{word.text}</h2>
      <div className="underline" />
      <h4>{word.meaning}</h4>
      <div className="examples-list">
        {word.examples.map((example) => (
          <p key={example}>{example}</p>
        ))}
      </div>
    </div>
  );
}

Word.propTypes = {
  word: PropTypes.shape({
    text: PropTypes.string.isRequired,
    meaning: PropTypes.string.isRequired,
    examples: PropTypes.arrayOf(PropTypes.string).isRequired,
  }).isRequired,
};

export default Word;
