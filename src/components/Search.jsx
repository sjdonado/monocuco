import React from 'react';
import PropTypes from 'prop-types';
import '../App.scss';

function Button() {
  return (
    <button className="get-word__button" type="submit">
      <span className="glyphicon glyphicon-search get-word__button-icon" aria-hidden="true" />
    </button>
  );
}

function Input({ onUpdateWord, word }) {
  return (
    <input
      id="get-word-input"
      className="get-word__input"
      type="text"
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      onChange={(e) => onUpdateWord(e.target.value.toLowerCase())}
      value={word}
    />
  );
}

Input.propTypes = {
  onUpdateWord: PropTypes.func.isRequired,
  word: PropTypes.string.isRequired,
};

function Search({ onUpdateWord, word, onSubmitWord }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmitWord(word);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="get-word-wrapper">
        <Input onUpdateWord={onUpdateWord} word={word} />
        <Button />
      </div>
    </form>
  );
}

Search.propTypes = {
  word: PropTypes.string.isRequired,
  onUpdateWord: PropTypes.func.isRequired,
  onSubmitWord: PropTypes.func.isRequired,
};

export default Search;
