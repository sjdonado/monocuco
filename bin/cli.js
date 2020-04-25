const program = require('commander');
const inquirer = require('inquirer');

const path = require('path');
const fs = require('fs');

const DATA_PATH = path.join(__dirname, '..', 'src/data.json');
// eslint-disable-next-line import/no-dynamic-require
const words = require(DATA_PATH);

const validate = (val) => (val === '' ? 'Es necesario un valor.' : true);

const receiver = async () => {
  const {
    text,
    meaning,
    synonyms,
    examples,
    author_name: name,
    author_link: link,
  } = await inquirer.prompt([
    {
      type: 'input',
      message: 'Palabra',
      name: 'text',
      validate,
    },
    {
      type: 'input',
      message: 'Significado',
      name: 'meaning',
      validate,
    },
    {
      type: 'input',
      message: 'Sinónimos (separados por coma)',
      name: 'synonyms',
    },
    {
      type: 'editor',
      message: 'Por favor, escribe un ejemplo por línea.',
      name: 'examples',
      validate,
    },
    {
      type: 'input',
      message: '¿Cuál es tu nombre?',
      name: 'author_name',
      validate,
    },
    {
      type: 'input',
      message: '¿Cuál es el link de tu cuenta en GitHub?',
      name: 'author_link',
      validate: (val = '') => (!/^https?:\/\/(www.)?github\.com\/[a-zA-Z0-9]+$/.test(val) ? 'Enlace inválido' : true),
    },
  ]);

  const trimLines = (line) => line.trim();
  const nonEmpty = (elem) => elem.length > 0;

  words.push({
    text,
    meaning,
    synonyms: synonyms.split(',').map(trimLines).filter(nonEmpty),
    examples: examples.split('\n').map(trimLines).filter(nonEmpty),
    author: {
      name,
      link,
    },
  });

  words.sort((a, b) => a.text.localeCompare(b.text));

  fs.writeFile(DATA_PATH, JSON.stringify(words, null, 2), (err) => {
    if (err) throw err;
    console.log('\n¡Nueva palabra agregada correctamente! ¡Gracias!');
    console.log('Ya puedes hacer commit y realizar el PR. ;)');
  });
};

program.version('1.0.0').action(receiver);

program.parse(process.argv);
