// Special debug globals
var clic = require('cli-color');
var look = require('util').inspect;

GLOBAL.peek = function peek(val) {
  console.log(clic.magentaBright(look(val)));
};
GLOBAL.peek1 = function peek1(val) {
  console.log(clic.cyanBright(look(val)));
};
GLOBAL.peek2 = function peek2(val) {
  console.log(clic.yellowBright(look(val)));
};
GLOBAL.peek3 = function peek3(val) {
  console.log(clic.greenBright(look(val)));
};
GLOBAL.peek4 = function peek4(val) {
  console.log(clic.whiteBright(look(val)));
};
GLOBAL.peek5 = function peek5(val) {
  console.log(clic.redBright(look(val)));
};

var Connection = require('./connection');
var Collection = require('./collection');
var Errors = require('waterline-errors').adapter;
var linq = require('linq');
// These modules are (potentially) loaded globally by sails
var async = async || require('async');
var _ = _ || require('lodash');

var bank = {};
module.exports = adapter = {
  identity: 'sails-raven',
  pkFormat: 'string',
  syncable: false,
  ravendb: Connection.ravendb,

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
      cb(Errors.IdentityMissing);
    } else if (bank[connection.identity]) {
      cb(Errors.IdentityDuplicate);
    } else {
      //var config = this.defaults ? _.extend({}, this.defaults, connection) : connection;

      // Store the connection
      bank[connection.identity] = {
        config: connection,
        collections: {}
      };

      // Create a new active connection
      new Connection(connection, function (err, db) {
        if (err) {
          return cb(err);
        } else {
          bank[connection.identity].connection = db;

          // Build up a registry of collections
          Object.keys(collections).forEach(function (key) {
            bank[connection.identity].collections[key] = new Collection(collections[key], db);
          });

          return cb();
        }
      });
    }
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
  teardown: function (connectionName, cb) {
    if (typeof connectionName == 'function') {
      cb = connectionName;
      conn = null;
    }
    if (!connectionName) {
      bank = {};
      cb();
    }
    if (!bank[connectionName]) {
      cb();
    }
    delete bank[connectionName];
    cb();
  },

  // Return attributes
  describe: function (connectionName, collectionName, cb) {
    var connectionObject = bank[connectionName];
    var collection = connectionObject.collections[collectionName];
    var schema = collection.schema;
    return cb(null, schema);
  },

  /**
   *
   * REQUIRED method if integrating with a schemaful
   * (SQL-ish) database.
   *
   */
  define: function (connectionName, collectionName, definition, cb) {
    var connectionObject = bank[connectionName];
    var collection = connectionObject.collections[collectionName];

    // Create the collection and indexes
    connectionObject.connection.createCollection(collectionName, collection, cb);
  },

  /**
   *
   * REQUIRED method if integrating with a schemaful
   * (SQL-ish) database.
   *
   */
  drop: function (connectionName, collectionName, relations, cb) {
    if (typeof relations === 'function') {
      cb = relations;
      relations = [];
    }

    var connectionObject = bank[connectionName];
    var collection = connectionObject.collections[collectionName];

    // Drop the collection and indexes
    connectionObject.connection.dropCollection(collectionName, cb);
  },

  /**
   * Native
   *
   * Give access to a native ravendb collection object for running custom
   * queries.
   *
   * @param {String} connectionName
   * @param {String} collectionName
   * @param {Function} cb
   */
  'native': function (connectionName, collectionName, cb) {
    var connectionObject = bank[connectionName];
    cb(null, connectionObject.connection.db.collection(collectionName));
  },

  /**
   * Create
   *
   * Insert a single document into a collection.
   *
   * @param {String} connectionName
   * @param {String} collectionName
   * @param {Object} data
   * @param {Function} cb
   */
  create: function (connectionName, collectionName, data, cb) {
    peek4('create');
    var connectionObject = bank[connectionName];
    var collection = connectionObject.collections[collectionName];

    // Insert a new document into the collection
    collection.create(data, function (err, results) {
      cb(err, !err && results[0]);
    });
  },

  /**
   * Create Each
   *
   * Insert an array of documents into a collection.
   *
   * @param {String} connectionName
   * @param {String} collectionName
   * @param {Object} data
   * @param {Function} cb
   */
  createEach: function (connectionName, collectionName, data, cb) {
    peek4('createEach');
    if (data.length === 0) {
      cb(null, []);
    } else {
      var connectionObject = bank[connectionName];
      var collection = connectionObject.collections[collectionName];

      // Insert a new document into the collection
      collection.create(data, function (err, results) {
        cb(err, !err && results);
      });
    }
  },

  /**
   * Find
   *
   * Find all matching documents in a colletion.
   *
   * @param {String} connectionName
   * @param {String} collectionName
   * @param {Object} options
   * @param {Function} callback
   */ // This one is the new one
  find: function (connectionName, collectionName, options, cb) {
    peek4('find');
    options = options || {};
    var connectionObject = bank[connectionName];
    var collection = connectionObject.collections[collectionName];

    // Find all matching documents
    collection.find(options, cb);
  },

  destroy: function (connectionName, collectionName, options, cb) {
    peek4('destroy');
    options = options || {};
    var connectionObject = bank[connectionName];
    var collection = connectionObject.collections[collectionName];

    // Find all matching documents
    collection.destroy(options, cb);
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
//adapter.find = function (connectionName, collectionName, options, cb) {
//   var db = this.getDatabase(connectionName);
//   if (!options || !options.where) {
//     db.getDocsInCollection(collectionName, 0, 1024, cb);
//   } else {
//     var filter = options.where || options;
//     db.queryIndex(filter, function (err, docs) {
//       cb(err, docs);
//     });
//   }
// };

// adapter.findOne = function (connectionName, collectionName, options, cb) {
//   var db = this.getDatabase(connectionName);
//   var filter = options.where || options;
//   db.queryIndex(filter, function (err, docs) {
//     if (docs instanceof Array) {
//       cb(err, docs[0]);
//     } else {
//       cb(err, docs);
//     }
//   });
// };

// adapter.create = function (connectionName, collectionName, value, cb) {
//   var db = this.getDatabase(connectionName);
//   var obj = Document.fromModel(value, collectionName);
//   db.saveDocument(collectionName, obj, function (err, doc) {
//     cb(err, doc);
//   });
// };

// adapter.createEach = function (connectionName, collectionName, values, cb) {
//   var self = this;
//   async.map(values, function (value, next) {
//     self.create(connectionName, collectionName, value, next);
//   }, cb);
// };

// adapter.update = function (connectionName, collectionName, options, values, cb) {
//   var db = this.getDatabase(connectionName);
//   if (value instanceof Array) {
//     async.mapSeries(values, function (val, next) {
//       var obj = Document.fromModel(val, collectionName);
//       db.saveDocument(collectionName, obj, function (err, doc) {
//         next(err, doc);
//       });
//     }, function (err, results) {
//       cb(err, results);
//     });
//   } else {
//     var obj = Document.fromModel(value, collectionName);
//     db.saveDocument(collectionName, obj, function (err, doc) {
//       cb(err, doc);
//     });
//   }
// };

// adapter.destroyAll = function (connectionName, collectionName, cb) {
//   var db = this.getDatabase(connectionName);
//   db.getDocsInCollection(collectionName, 0, 1024, function (err, docs) {
//     if (docs instanceof Array) {
//       async.each(docs, function (doc, done) {
//           doc.toModel(getSchema(connectionName, collectionName));
//           db.deleteDocument(doc.attributes.getRavenKey(), done);
//         },
//         function (err) {
//           cb(err, docs);
//         });
//     } else {
//       doc.toModel(getSchema(connectionName, collectionName));
//       db.deleteDocument(docs.attributes.getRavenKey(), function (err) {
//         cb(err, docs);
//       });
//     }
//   });
// };

// adapter.destroy = function (connectionName, collectionName, options, cb) {
//   if (options.where === null) {
//     adapter.destroyAll(connectionName, collectionName, cb);
//   } else {
//     var db = this.getDatabase(connectionName);
//     var filter = options.where || options;
//     db.queryIndex(filter, function (err, docs) {
//       async.each(docs, function (doc, done) {
//         db.deleteDocument(doc.id, done);
//       }, function (err) {
//         cb(err, docs);
//       });
//     });
//   }
// };
