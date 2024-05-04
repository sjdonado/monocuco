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
    <div className="relative flex flex-col items-center justify-start text-center min-h-[282px] w-[380px] shadow-md bg-white m-6 p-[22px_16px]">
      <div className="word-header-wrapper flex flex-row items-center justify-center h-24">
        <div className="word-header__header text-6xl h-full">{highlightText(word.text)}</div>
      </div>
      <h6 className="mt-6 text-justify">{word.meaning}</h6>
      {synonyms.length > 0 && (
        <div className="synonyms-list flex flex-col font-italic">
          <span className="list-title font-bold text-sm mt-4">Sinónimos</span>
          {highlightText(synonyms)}
        </div>
      )}
      <div className="examples-list flex flex-col font-italic mt-6 mb-12">
        <span className="list-title font-bold text-sm">Ejemplos</span>
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
