export default function GithubButtons() {
  return (
    <div className="flex w-full justify-start items-end flex-col h-full p-3 text-xs mb-1.5">
      <div className="flex gap-6">
        <a
          href="https://github.com/sjdonado/monocuco/fork"
          data-icon="octicon-repo-forked"
          data-show-count="true"
          aria-label="Fork sjdonado/monocuco on GitHub"
        >
          Fork
        </a>
        <a
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
}
