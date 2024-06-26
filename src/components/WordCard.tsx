import Highlighter from 'react-highlight-words';

interface Props {
  word: Word;
  currentWord: string;
}

export default function WordCard({ word, currentWord }: Props) {
  const synonyms = word.synonyms.join(', ');

  const searchWords = currentWord.split(' ');
  const mainWords = searchWords.filter((text) => text.length > 2);
  if (searchWords.length > mainWords.length) {
    mainWords.push(currentWord);
  }

  const highlightText = (text: string, className?: string) => (
    <Highlighter
      className={className}
      highlightClassName="highlight"
      searchWords={mainWords}
      autoEscape
      textToHighlight={text}
    />
  );

  return (
    <div className="relative flex w-full flex-col items-center justify-start gap-5 rounded-lg border bg-white p-4 text-center lg:w-[672px] lg:max-w-2xl dark:border-gray-700 dark:bg-gray-900">
      <div className="flex w-full flex-col gap-2">
        {synonyms.length > 0 && (
          <div className="flex justify-end text-sm">Sin. {highlightText(synonyms)}</div>
        )}
        {highlightText(word.text, 'h-full text-3xl')}
        <span className="mx-auto w-20 border-t-2 border-red-400" />
      </div>
      <h3 className="text-justify italic">"{word.meaning}"</h3>
      <ul className="w-full list-inside list-disc text-left">
        {word.examples.map((example, idx) => (
          <li key={idx}>{highlightText(example)}</li>
        ))}
      </ul>
      <div className="flex w-full justify-end gap-1 text-xs">
        <span>Añadida por:</span>
        {word.authors.map(({ name, link }) => (
          <a
            key={`${word.text}-${link}`}
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {name}
          </a>
        ))}
      </div>
    </div>
  );
}
