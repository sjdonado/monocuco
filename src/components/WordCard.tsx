import Highlighter from 'react-highlight-words';

interface Props {
  word: Word;
  currentWord: string;
}

export default function WordCard({ word, currentWord }: Props) {
  const authors = word.authors.map(({ name }) => name).join(', ');
  const synonyms = word.synonyms.join(', ');

  const searchWords = currentWord.split(' ');
  const mainWords = searchWords.filter((text) => text.length > 2);
  if (searchWords.length > mainWords.length) {
    mainWords.push(currentWord);
  }

  const highlightText = (text: string) => (
    <Highlighter
      highlightClassName="highlight"
      searchWords={mainWords}
      autoEscape
      textToHighlight={text}
    />
  );

  return (
    <div className="relative flex w-full flex-col items-center justify-start gap-4 rounded-lg border p-4 text-center lg:w-[512px] lg:max-w-lg">
      <div className="h-full text-3xl">{highlightText(word.text)}</div>
      <h3 className="text-justify italic">"{word.meaning}"</h3>
      {synonyms.length > 0 && (
        <div className="flex w-full flex-col">
          <span className="text-sm font-semibold">Sinónimos</span>
          {highlightText(synonyms)}
        </div>
      )}
      <ul className="list-inside list-disc w-full text-left">
        {word.examples.map((example, idx) => (
          <li key={idx}>{highlightText(example)}</li>
        ))}
      </ul>
      <div className="flex w-full justify-end gap-1 text-xs">
        <span>Añadida por:</span>
        {word.authors.map(({ link }) => (
          <a
            key={`${word.text}-${link}`}
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {authors}
          </a>
        ))}
      </div>
    </div>
  );
}
