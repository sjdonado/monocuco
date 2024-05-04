import Highlighter from 'react-highlight-words';

interface Props {
  word: Word;
  currentWord: string;
}

export default function Word({ word, currentWord }: Props) {
  const authors = word.authors.map(({ name }) => name).join(', ');
  const synonyms = word.synonyms.join(', ');

  const searchWords = currentWord.split(' ');
  const mainWords = searchWords.filter((text) => text.length > 2);
  if (searchWords.length > mainWords.length) {
    mainWords.push(currentWord);
  }

  const highlightText = (text: string, key?: string) => (
    <Highlighter
      key={key}
      highlightClassName="highlight"
      searchWords={mainWords}
      autoEscape
      textToHighlight={text}
    />
  );

  return (
    <div className="relative m-6 flex min-h-[282px] w-[380px] flex-col items-center justify-start bg-white p-[22px_16px] text-center shadow-md">
      <div className="word-header-wrapper flex h-24 flex-row items-center justify-center">
        <div className="word-header__header h-full text-6xl">{highlightText(word.text)}</div>
      </div>
      <h6 className="mt-6 text-justify">{word.meaning}</h6>
      {synonyms.length > 0 && (
        <div className="synonyms-list font-italic flex flex-col">
          <span className="list-title mt-4 text-sm font-bold">Sinónimos</span>
          {highlightText(synonyms)}
        </div>
      )}
      <div className="examples-list font-italic mb-12 mt-6 flex flex-col">
        <span className="list-title text-sm font-bold">Ejemplos</span>
        {word.examples.map((example) => highlightText(example, example))}
      </div>
      <div className="credits absolute bottom-4 right-4">
        <span className="mr-2 text-xs">Añadida por: </span>
        {word.authors.map(({ link }) => (
          <a
            key={`${word.text}-${link}`}
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs"
          >
            {authors}
          </a>
        ))}
      </div>
    </div>
  );
}
