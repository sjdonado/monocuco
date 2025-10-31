import GitHubButton from 'react-github-btn';

export default function GithubButtons() {
  return (
    <div className="flex size-full flex-col items-end justify-start p-3 text-xs">
      <div className="flex gap-2">
        <GitHubButton
          href="https://github.com/sjdonado/monocuco/fork"
          data-color-scheme="no-preference: light; light: light; dark: dark;"
          data-icon="octicon-repo-forked"
          data-size="large"
          data-show-count="true"
          aria-label="Fork sjdonado/monocuco on GitHub"
        >
          Fork
        </GitHubButton>
        <GitHubButton
          href="https://github.com/sjdonado/monocuco"
          data-color-scheme="no-preference: light; light: light; dark: dark;"
          data-icon="octicon-star"
          data-size="large"
          data-show-count="true"
          aria-label="Star sjdonado/monocuco on GitHub"
        >
          Star
        </GitHubButton>
      </div>
      <div className="flex gap-2">
        <p>¿Buscas añadir una palabra?</p>
        <a
          className="underline"
          href="https://github.com/sjdonado/monocuco/blob/master/README.md"
          target="_blank"
          rel="noopener noreferrer"
        >
          Click aquí
        </a>
      </div>
    </div>
  );
}
