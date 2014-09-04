var raven = require('./raven');
var Document = raven.Document;
var Database = raven.Database;
var linq = require('linq');
// These modules are (potentially) loaded globally by sails
var async = async || require('async');
var _ = _ || require('lodash');
// Debugging
var look = require('util').inspect;

module.exports = (function () {
  var connections = {};
  var adapter = {
    identity: 'sails-raven',
    pkFormat: 'string',
    syncable: false,

    // Default configuration for connections
    defaults: {
      port: 80,
      host: 'http://local.raven.arhaus.com',
      database: 'OAuth_Prototype',
      schema: false
    },

    /**
     *
     * This method runs when a model is initially registered
     * at server-start-time.  This is the only required method.
     *
     * @param  {[type]}   connection [description]
     * @param  {[type]}   collections [description]
     * @param  {Function} cb         [description]
     * @return {[type]}              [description]
     */
    registerConnection: function (connection, collections, cb) {
      if (!connection.identity) {
        return cb(new Error('Connection is missing an identity.'));
      }
      if (connections[connection.identity]) {
        return cb(new Error('Connection is already registered.'));
      }

      var config = this.defaults ? _.extend({}, this.defaults, connection) : connection;
      connection.db = raven(connection.host + ':' + connection.port, connection.database);
      connection.collections = collections;
      connections[connection.identity] = connection;

      for (var x in collections) {
        var pk, defs = collections[x].definition;
        if (!defs.getRavenKey) {
          for (var y in defs) {
            if (defs[y] && defs[y].primaryKey === true) {
              console.log(y + ' ' + look(defs[y]));
              defs.getRavenKey = function () {
                return collections[x].globalId + '/' + this[y];
              };
              break;
            }
          }
        }
      }

      return cb();
    },

    /**
     * Fired when a model is unregistered, typically when the server
     * is killed. Useful for tearing-down remaining open connections,
     * etc.
     *
     * @param  {Function} cb [description]
     * @return {[type]}      [description]
     */
    // Teardown a Connection
    teardown: function (conn, cb) {

      if (typeof conn == 'function') {
        cb = conn;
        conn = null;
      }
      if (!conn) {
        connections = {};
        cb();
      }
      if (!connections[conn]) {
        cb();
      }
      delete connections[conn];
      cb();
    },

    // Return attributes
    describe: function (connection, collection, cb) {
      // Add in logic here to describe a collection (e.g. DESCRIBE TABLE logic)
      return cb();
    },

    /**
     *
     * REQUIRED method if integrating with a schemaful
     * (SQL-ish) database.
     *
     */
    define: function (connection, collection, definition, cb) {
      // Add in logic here to create a collection (e.g. CREATE TABLE logic)
      return cb();
    },

    /**
     *
     * REQUIRED method if integrating with a schemaful
     * (SQL-ish) database.
     *
     */
    drop: function (connection, collection, relations, cb) {
      // Add in logic here to delete a collection (e.g. DROP TABLE logic)
      return cb();
    },

    getDatabase: function (connection) {
      return connections[connection].db;
    },

    getSchema: function (connection, collection) {
      return connections[connection].collections[collection];
    }
  };

  /**
   *
   * REQUIRED method if users expect to call Model.find(), Model.findOne(),
   * or related.
   *
   * You should implement this method to respond with an array of instances.
   * Waterline core will take care of supporting all the other different
   * find methods/usages.
   *
   */
  adapter.find = function (connection, collection, options, cb) {
    var db = this.getDatabase(connection);
    if (!options || !options.where) {
      db.getDocsInCollection(collection, 0, 1024, cb);
    } else {
      var filter = options.where || options;
      db.queryIndex(filter, function (err, docs) {
        cb(err, docs);
      });
    }
  };

  adapter.findOne = function (connection, collection, options, cb) {
    var db = this.getDatabase(connection);
    var filter = options.where || options;
    db.queryIndex(filter, function (err, docs) {
      if (docs instanceof Array) {
        cb(err, docs[0]);
      } else {
        cb(err, docs);
      }
    });
  };

  adapter.create = function (connection, collection, value, cb) {
    var db = this.getDatabase(connection);
    var obj = Document.fromModel(value, collection);
    db.saveDocument(collection, obj, function (err, doc) {
      cb(err, doc);
    });
  };

  adapter.createEach = function (connection, collection, values, cb) {
    var self = this;
    async.map(values, function (value, next) {
      self.create(connection, collection, value, next);
    }, cb);
  };

  adapter.update = function (connection, collection, options, values, cb) {
    var db = this.getDatabase(connection);
    if (value instanceof Array) {
      async.mapSeries(values, function (val, next) {
        var obj = Document.fromModel(val, collection);
        db.saveDocument(collection, obj, function (err, doc) {
          next(err, doc);
        });
      }, function (err, results) {
        cb(err, results);
      });
    } else {
      var obj = Document.fromModel(value, collection);
      db.saveDocument(collection, obj, function (err, doc) {
        cb(err, doc);
      });
    }
  };

  adapter.destroyAll = function (connection, collection, cb) {
    var db = this.getDatabase(connection);
    db.getDocsInCollection(collection, 0, 1024, function (err, docs) {
      if (docs instanceof Array) {
        async.each(docs, function (doc, next) {
            doc.toModel(getSchema(connection, collection));
            db.deleteDocument(doc.attributes.getRavenKey(), next);
          },
          function (err) {
            cb(err, docs);
          });
      } else {
        doc.toModel(getSchema(connection, collection));
        db.deleteDocument(docs.attributes.getRavenKey(), function (err) {
          cb(err, docs);
        });
      }
    });
  };

  adapter.destroy = function (connection, collection, options, cb) {
    if (options.where === null) {
      adapter.destroyAll(connection, collection, cb);
    } else {
      var db = this.getDatabase(connection);
      var filter = options.where || options;
      db.queryIndex(filter, function (err, docs) {
        async.eachSeries(docs, function (doc, next) {
          db.deleteDocument(doc.id, next);
        }, function (err) {
          cb(err, docs);
        });
      });
    }
  };

  // Expose adapter definition
  return adapter;
})();
