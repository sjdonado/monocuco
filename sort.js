const fs = require('fs');
const words = require('./src/data.json');

words.sort((a, b) => a.text.localeCompare(b.text));

fs.writeFile('./src/data.json', JSON.stringify(words, null, 2), (err) => {
  if (err) throw err;
  console.log('data.json sorted successfully!');
});
