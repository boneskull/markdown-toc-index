#!/usr/bin/env node
'use strict';

var yargs = require('yargs'),
  Promise = require('bluebird'),
  isString = require('lodash.isstring'),
  mapValues = require('lodash.mapvalues'),
  isNumber = require('lodash.isnumber'),
  markdownIndex = require('../index');

var argv = yargs
    .option('inject', {
      alias: 'i',
      describe: 'Do not output to STDOUT; instead, inject TOC into file at ' +
      'range marked by "<!-- INDEX -->...<!-- /INDEX -->".  Mutually exclusive ' +
      'with "--output"'
    })
    .option('exclude', {
      alias: 'x',
      describe: 'Exclude a glob.  Injected file (if any) and node_modules/ ' +
      'are excluded by default'
    })
    .option('output', {
      alias: 'o',
      describe: 'Do not write to SDTOUT; instead, write to file.  Mutually ' +
      'exclusive with "--inject"'
    })
    .option('template', {
      type: 'string',
      describe: 'The Lo-Dash template used to generate the Table of Contents.'
    })
    .option('bullet', {
      describe: 'The bullet to use for each item in the generated TOC.',
      type: 'string',
      default: '-'
    })
    .option('max-depth', {
      describe: 'Use headings whose depth is at most maxDepth.',
      type: 'number',
      default: 3
    })
    .option('firsth1', {
      describe: 'Include the first h1-level heading in a file.',
      type: 'boolean',
      default: false
    })
    .option('omit', {
      describe: 'Omit entire headings from the TOC if they have these strings.',
      type: 'array'
    })
    .option('clean', {
      describe: 'Strip "blackedlisted" keywords from the headings.',
      type: 'array'
    })
    .option('allowedChars', {
      describe: 'Whitelist these characters when slugifying headings',
      default: '-',
      type: 'string'
    })
    .strict()
    .usage('Writes an index for a directory fulla Markdown files to STDOUT.' +
    '\n\nUsage: $0 [options] [marked-toc-options] [directory-or-glob]')
    .example('$0 --inject README.md docs/',
    'Inject an index of all *.md files within docs/ and its subdirectories ' +
    'into README.md')
    .example('$0 --inject README.md --max-depth 2 --firsth1 README.md',
    'Examine README.md and inject a TOC into it, passing the "max-depth" and' +
    '"firsth1" options through to the marked-toc package')
    .example('$0 --output INDEX.md docs/*.md',
    'Output the index of files matching glob docs/*.md to new file INDEX.md')
    .help('help')
    .alias('help', 'h')
    .epilog('See https://www.npmjs.com/package/marked-toc for info on extra' +
    'options.  All options for marked-toc must be key/value pairs; flags are' +
    'not supported.')
    .version(function getVersion() {
      return require('../package.json').version;
    })
    .alias('version', 'v')
    .check(function checkArgs(argv) {
      if (argv.inject && argv.output) {
        throw new Error('--inject and --output cannot be used together');
      }
      if (argv.bullet.length === 1) {
        argv.bullet += ' ';
      }
      return true;
    })
    .argv,

  glob = argv._[0] || process.cwd(),

  maxDepth = argv.maxDepth;

if (isNumber(maxDepth)) {
  argv.maxDepth = Math.floor(maxDepth);
}

argv = mapValues(argv, function (value) {
  if (isString(value)) {
    return value.replace(/\\/g, '');
  }
  return value;
})

markdownIndex(glob, argv)
  .then(function (data) {
    var inject = argv.inject,
      output = argv.output;

    if (inject) {
      return markdownIndex.inject(inject, data)
        .then(function () {
          console.log('Injected TOC into %s', inject);
        });
    }

    if (output) {
      return Promise.promisify(require('fs').writeFile)(output, data)
        .then(function () {
          console.log('Wrote TOC to %s', output);
        })
    }

    process.stdout.write(data);
  })
  .catch(function (err) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error(err);
  });
