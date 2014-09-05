var Datastore = require('./datastore');
var ravendb = function (datastoreUrl, databaseName) {
  var ds = new Datastore(datastoreUrl);
  return ds.useDatabase(databaseName || 'Default');
};
ravendb.Datastore = Datastore;
ravendb.Database = require('./database');
ravendb.Document = require('./document');
var Document = ravendb.Document;
var Database = ravendb.Database;
var _ = _ || require('lodash');
var async = async || require('async');

// Debugging
var look = require('util').inspect;

// Escape special lucene chars
var specialChars = ['+', '-', '&&', '||', '!', '(', ')', '{', '}', '[', ']', '^', '"', '~', '*', '?', ':', '\\'];
var escapeLucene = function (val) {
  if (_.isString(val)) {
    return '"' + val.replace('\\', '').replace(/([+\-!(){}\[\]^"~*?:\\]|&&|\bAND\b|\|\||\bOR\b)/ig, '\\$1') + '"';
  } else {
    return val;
  }
};

// Fixup raven document key
Document.fromModel = function (object, collection) {
  if (!object.getMetadataValue) {
    var doc = new Document();
    _.extend(doc, object);
    if (object.attributes && object.attributes.getRavenKey) {
      doc.setMetadataValue('Key', object.attributes.getRavenKey());
      doc.setMetadataValue('@id', object.attributes.getRavenKey());
      doc.setMetadataValue('Raven-Entity-Name', object.globalId);
    } else if (!doc.id) {
      doc.id = collection + '/' + object[Object.keys(object)[0]];
      doc.setMetadataValue('Key', doc.id);
    }
    return doc;
  } else {
    return object;
  }
};

Document.prototype.toModel = function (model) {
  _.extend(this, model);
  return this;
};

Database.prototype.query = function (search, start, count, cb) {
  // var terms = {};
  // for (var term in search) {
  //   terms[term] = escapeLucene(search[term]);
  // }
  this.queryByIndex(Database.DYNAMIC_INDEX, search, start, count, cb);
};

Database.prototype.queryIndex = function (filter, cb) {
  var self = this;
  // if (typeof filter === 'object' && !filter.where) {
  //   filter = {
  //     where: filter
  //   };
  // }

  // filter = filter.where || filter;

  this.query(filter, filter.skip || 0, filter.limit || 1024, function (err, data) {
    if (err) {
      throw err;
    }
    var body = JSON.parse(data.body);
    if (body.Error) {
      throw Error(body.Error);
    } else if (body.IsStale === true) {
      self.waitForIndex(filter, cb);
    } else if (body.IsStale === false) {
      async.mapSeries(body.Results, function (result, next) {
        //result.id = result.id || result['@metadata']['Key'];
        next(null, result);
      }, function (err, results) {
        cb(err, results);
      });
    } else {
      throw Error('Something bad happened with the query: ' + err);
    }
  });

};

Database.prototype.waitForIndex = function (filter, cb) {
  var self = this;
  setTimeout(function () {
    self.queryIndex(filter, cb);
  }, 50);
};

module.exports = ravendb;
