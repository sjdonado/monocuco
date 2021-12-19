import React from 'react';

import Input from './Input';

import './Search.scss';

interface Props {
  word: string;
  onUpdateWord: (word: string) => void;
  totalWords: number;
  resultStats: number;
}

const Search = function Search({
  word,
  onUpdateWord,
  totalWords,
  resultStats,
}: Props) {
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
};

export default Search;
