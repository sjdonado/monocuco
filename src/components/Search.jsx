import React from 'react';
import PropTypes from 'prop-types';
import '../App.scss';

function Input({ onUpdateWord, word }) {
  return (
    <input
      id="search-input"
      className="search__input"
      type="text"
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      onChange={(e) => onUpdateWord(e.target.value)}
      value={word}
    />
  );
}

Input.propTypes = {
  onUpdateWord: PropTypes.func.isRequired,
  word: PropTypes.string.isRequired,
};

function Search({ onUpdateWord, word }) {
  return (
    <div className="search-wrapper">
      <Input onUpdateWord={onUpdateWord} word={word} />
      <div className="search__icon-wrapper">
        <i className="fas fa-search search__icon-icon" />
      </div>
    </div>
  );
}

Search.propTypes = {
  word: PropTypes.string.isRequired,
  onUpdateWord: PropTypes.func.isRequired,
};

export default Search;
