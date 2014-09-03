var ravendb = require('./ravendb/ravendb');
var Document = ravendb.Document;
var Database = ravendb.Database;
var _ = _ || require('lodash');
var async = async || require('async');
// Debugging
var look = require('util').inspect;

// Escape special lucene chars
var specialChars = ['+', '-', '&&', '||', '!', '(', ')', '{', '}', '[', ']', '^', '"', '~', '*', '?', ':', '\\'];
var escapeLucene = function(val) {
  if (_.isString(val)) {
    return '"' + val.replace('\\', '').replace(/([+\-!(){}\[\]^"~*?:\\]|&&|\bAND\b|\|\||\bOR\b)/ig, '\\$1') + '"';
  } else {
    return val;
  }
};

// Fixup raven document key
Document.fromObject = function(object, collection) {
  if (!object.getMetadataValue) {
    var doc = new Document();
    _.extend(doc, object);
    if (!doc.id) {
      doc.id = collection + '/' + object[Object.keys(object)[0]];
    }
    doc.setMetadataValue('Key', doc.id);
    return doc;
  } else {
    return object;
  }
};

Database.prototype.query = function(search, start, count, cb) {
  var terms = {};
  for (var term in search) {
    terms[term] = escapeLucene(search[term]);
  }
  this.queryByIndex(Database.DYNAMIC_INDEX, terms, start, count, cb);
};

Database.prototype.queryIndex = function(filter, cb) {
  var self = this;
  if (typeof filter === 'string') {
    filter = {
      where: {
        id: filter
      }
    };
  } else if (typeof filter === 'object' && !filter.where) {
    filter = {
      where: filter
    };
  }

  filter = filter.where || filter;
  if (filter.id) {
    this.getDocument(filter.id, function(err, doc) {
      doc.id = doc.id || result['@metadata']['Key'];
      cb(err, [doc]);
    });
  } else {
    this.query(filter, filter.skip || 0, filter.limit || 1024, function(err, data) {
      if (err) {
        throw err;
      }
      var body = JSON.parse(data.body);
      if (body.Error) {
        throw Error(body.Error);
      } else if (body.IsStale === true) {
        self.waitForIndex(filter, cb);
      } else if (body.IsStale === false) {
        async.mapSeries(body.Results, function(result, next) {
          result.id = result.id || result['@metadata']['Key'];
          next(null, result);
        }, function(err, results) {
          cb(err, results);
        });
      } else {
        throw Error('Something bad happened with the query: ' + err);
      }
    });
  }
};

Database.prototype.waitForIndex = function(filter, cb) {
  var self = this;
  setTimeout(function() {
    self.queryIndex(filter, cb);
  }, 50);
};

module.exports = ravendb;
module.exports.Database = Database;
module.exports.Document = Document;