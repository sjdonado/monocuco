import Input from './Input';

interface Props {
  word: string;
  onUpdateWord: (word: string) => void;
  totalWords: number;
  resultStats: number;
}

export default function Search({ word, onUpdateWord, totalWords, resultStats }: Props) {
  return (
    <div className="w-[480px] mx-auto mt-10 sm:w-9/12">
      <div className="flex justify-center items-center">
        <Input onUpdateWord={onUpdateWord} word={word} />
        <div className="flex justify-center items-center h-20 w-42 border border-l-0 border-gray-400 bg-white">
          <i className="fas fa-search text-xxl text-red-600" />
        </div>
      </div>
      <span className="result-stats">{`Resultados búsqueda: ${resultStats} de ${totalWords}`}</span>
    </div>
  );
}
