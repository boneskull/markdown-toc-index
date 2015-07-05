'use strict';

var util = require('util'),
  path = require('path'),
  globule = require('globule'),
  Promise = require('bluebird'),
  toc = require('marked-toc');

/**
 * Globs ignored by default.
 * @type {string[]}
 */
var IGNORED = ['node_modules/**/*.md', 'node_modules/**/*.markdown'],
  format = util.format,
  makeIgnoreFilter, markdownIndex,
  injectRegex = new RegExp('(<!--\\s*INDEX\\s*-->)[\\S\\s]*(<!--\\s*\\/INDEX\\s*-->)',
    'm'),
  fs = Promise.promisifyAll(require('fs')),
  DEFAULT_MAX_DEPTH = 3;

Promise.longStackTraces();

/**
 * Callback for TOC
 * @callback markdownIndex.tocCallback
 * @param {(Error|string|null)} Error, if any
 * @param {string} TOC
 */

/**
 * Creates a filter function to remove any occurance of `dir` from files
 * ignored by default.
 * @param {string} dir Dirpath
 * @see {@link IGNORED}
 * @returns {Function} Filter function
 */
makeIgnoreFilter = function makeIgnoreFilter(dir) {
  var normalizedDir = path.normalize(dir),
    /**
     * Filter function to assert a
     * @param {string} glob Ignored glob
     * @returns {boolean} If dir matches a glob
     */
    ignoreFilter = function ignoreFilter(glob) {
      return !globule.isMatch(glob, normalizedDir);
    };
  return ignoreFilter;
};

/**
 * Returns a string TOC for Markdown files found recursively in a given
 * directory.
 * `node_modules` is ignored.
 * @param {string} glob Dir to walk
 * @param {Object} [opts] Opts
 * @param {number} [opts.maxDepth] Number of levels deep to inspect
 * @param {string} [opts.exclude] Glob to exclude
 * @param {markdownIndex.tocCallback} [callback] Callback function; omit if
 * using Promises.
 * @returns {Promise.<string>} TOC
 */
markdownIndex = function markdownIndex(glob, opts, callback) {

  var filepaths, globs, ignored;
  var singular = false;
  var exclude;
  opts = opts || {};
  exclude = opts.exclude;

  if (!(glob && typeof glob === 'string')) {
    return Promise.reject(new Error('invalid parameters'))
      .nodeify(callback);
  }

  if (typeof exclude !== 'string') {
    callback = exclude;
    exclude = null;
  }

  /**
   * Filtered list of ignores that are not `dir`
   * @type {Array.<string>}
   */
  ignored = IGNORED
    .filter(makeIgnoreFilter(glob))
    .map(function (ignore) {
      return '!' + path.join(glob, ignore);
    });

  if (glob.charAt(glob.length - 1) === path.sep) {
    // in globule, ignored files must come last
    globs = [path.join(glob, '**', '*.md'), path.join(glob, '**', '*.markdown')]
      .concat(ignored);
  } else {
    globs = [glob].concat(ignored);
  }

  if (exclude) {
    globs.push(format('!%s', path.resolve(exclude)));
  }

  // Recursively read all markdown files
  filepaths = globule.find.apply(globule, globs);

  if (filepaths.length === 1) {
    singular = true;
  }

  return Promise.map(filepaths, function (filepath) {
    // Create table of contents
    return fs.readFileAsync(filepath, 'utf8')
      .then(function (file) {
        var basename, relative, table = toc(file, opts);

        basename = path.basename(filepath, '.md');
        if (basename === filepath) {
          basename = path.basename(filepath, '.markdown');
        }
        relative = path.relative(glob, filepath);

        if (singular) {
          return table;
        }

        // Add filename as a heading; prepend filename to links
        return format('### [%s](%s)\n%s', basename, relative, table)
          .replace(/\(#/g, format('(%s#', relative));
      });
  })
    .then(function (tables) {
      return tables.join('\n');
    })
    .nodeify(callback);
};

/**
 * Callback for inject
 * @callback markdownIndex.injectCallback
 * @param {(Error|string|null)} Error, if any
 * @param {*} Callback value from fs.writeFile
 */

/**
 * Inject a TOC string into file at range described by `injectRegex`
 * @param {string} filepath File to inject TOC into
 * @param {string} toc TOC string
 * @param {Function} [callback] Optional callback.  Omit if using Promises.
 * @returns {Promise} Resolves when complete
 */
markdownIndex.inject = function inject(filepath, toc, callback) {
  if (typeof toc !== 'string' || typeof filepath !== 'string' || !filepath) {
    return Promise.reject(new Error('invalid parameters'))
      .nodeify(callback);
  }

  return fs.readFileAsync(filepath, 'utf8')
    .then(function (str) {
      return fs.writeFileAsync(filepath,
        str.replace(injectRegex, format('$1\n%s\n$2', toc)));
    })
    .nodeify(callback);
};
markdownIndex.DEFAULT_MAX_DEPTH = DEFAULT_MAX_DEPTH;

module.exports = markdownIndex;
