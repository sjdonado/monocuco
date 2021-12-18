import React from 'react';

const GithubButtons: React.FC = function GithubButtons() {
  return (
    <div className="info">
      <div className="github-buttons-wrapper">
        <a
          className="github-button"
          href="https://github.com/sjdonado/monocuco/fork"
          data-icon="octicon-repo-forked"
          data-show-count="true"
          aria-label="Fork sjdonado/monocuco on GitHub"
        >
          Fork
        </a>
        <a
          className="github-button"
          href="https://github.com/sjdonado/monocuco"
          data-icon="octicon-star"
          data-show-count="true"
          aria-label="Star sjdonado/monocuco on GitHub"
        >
          Star
        </a>
      </div>
      <a
        href="https://github.com/sjdonado/monocuco/blob/master/README.md"
        target="_blank"
        rel="noopener noreferrer"
      >
        Buscas añadir una palabra? Click aquí
      </a>
    </div>
  );
};

export default GithubButtons;
