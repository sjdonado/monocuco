import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

import './Search.scss';

function Input({ onUpdateWord, word }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef) {
      inputRef.current.focus();
    }
  });

  return (
    <input
      ref={inputRef}
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

function Search(props) {
  const {
    onUpdateWord,
    word,
    resultStats,
    totalWords,
  } = props;
  return (
    <div className="search-container">
      <div className="search-wrapper">
        <Input
          onUpdateWord={onUpdateWord}
          word={word}
        />
        <div className="search__icon-wrapper">
          <i className="fas fa-search search__icon-icon" />
        </div>
      </div>
      <span className="result-stats">
        {`Resultados búsqueda: ${resultStats} de ${totalWords}`}
      </span>
    </div>
  );
}

Search.propTypes = {
  word: PropTypes.string.isRequired,
  onUpdateWord: PropTypes.func.isRequired,
  totalWords: PropTypes.number.isRequired,
  resultStats: PropTypes.number.isRequired,
};

export default Search;
