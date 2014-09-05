/**
 * Module dependencies
 */

var async = require('async');
var ravendb = require('./ravendb');
var Database = ravendb.Database;
var Document = ravendb.Document;

/**
 * Manage a connection to a Mongo Server
 *
 * @param {Object} config
 * @return {Object}
 * @api private
 */
var Connection = module.exports = function Connection(config, cb) {
  // Hold the config object
  this.config = config;

  // Build Database connection
  this.db = ravendb(config.host + ':' + config.port, config.database);
  return cb(null, this);
};

/**
 * Create A Collection
 *
 * @param {String} name
 * @param {Object} collection
 * @param {Function} cb
 * @api public
 */
Connection.prototype.createCollection = function createCollection(name, collection, cb) {
  // Create the Indexes
  this._ensureIndexes(result, collection.indexes, cb);
};

/**
 * Drop A Collection
 *
 * @param {String} name
 * @param {Function} cb
 * @api public
 */
Connection.prototype.dropCollection = function dropCollection(name, cb) {
  this.db.getDocsInCollection(name, 0, 1024, function (err, docs) {
    if (docs instanceof Array) {
      async.each(docs, function (doc, next) {
        this.db.deleteDocument(doc['@metadata']['@id'], next);
      }, cb);
    } else {
      this.db.deleteDocument(docs['@metadata']['@id'], cb);
    }
  });
};

/**
 * Ensure Indexes
 *
 * @param {String} collection
 * @param {Array} indexes
 * @param {Function} cb
 * @api private
 */
Connection.prototype._ensureIndexes = function _ensureIndexes(collection, indexes, cb) {
  var self = this;

  function createIndex(item, next) {
    collection.ensureIndex(item.index, item.options, next);
  }

  async.each(indexes, createIndex, cb);
};

module.exports.ravendb = ravendb;
