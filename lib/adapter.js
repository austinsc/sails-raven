/**
 * Module Dependencies
 */
// ...
// e.g.
// var _ = require('lodash');
// var mysql = require('node-mysql');
var ravendb = require('ravendb');
var Document = ravendb.Document;
var Database = ravendb.Database;

// These packages are loaded globally
var async = async || require('async');
var _ = _ || require('lodash');

// Fixup raven document key
Document.fromObject = function(object, collection) {
	if (!object.getMetadataValue) {
		var doc = new Document();
		_.extend(doc, object);
		if (!doc.id) {
			doc.id = collection + '/' + object[Object.keys(object)[0]];
		}
		doc.setMetadataValue("key", doc.id);
		return doc;
	} else {
		return object;
	}
};

Database.prototype.query = function(search, start, count, cb) {
	// var search = name != null ? { Tag: name } : null;
	for (var val in search) {
		search[val] = encodeURIComponent('"' + search[val] + '"');
	}
	this.queryByIndex(Database.DYNAMIC_INDEX, search, start, count, cb);
};

Database.prototype.queryIndex = function(filter, cb) {
	var self = this;
	this.query(filter, 0, 1024, function(err, data) {
		var body = JSON.parse(data.body);
		if (body.IsStale) {
			// console.log(require('util').inspect(body));
			self.waitForIndex(filter, cb);
		} else {
			cb(err, body.Results);
		}
	});
};

Database.prototype.waitForIndex = function(filter, cb) {
	var self = this;
	setTimeout(function() {
		self.queryIndex(filter, cb);
	}, 50);
};

/**
 * waterline-raven
 *
 * Most of the methods below are optional.
 *
 * If you don't need / can't get to every method, just implement
 * what you have time for.  The other methods will only fail if
 * you try to call them!
 *
 * For many adapters, this file is all you need.  For very complex adapters, you may need more flexiblity.
 * In any case, it's probably a good idea to start with one file and refactor only if necessary.
 * If you do go that route, it's conventional in Node to create a `./lib` directory for your private submodules
 * and load them at the top of the file with other dependencies.  e.g. var update = `require('./lib/update')`;
 */
module.exports = (function() {
	// You'll want to maintain a reference to each connection
	// that gets registered with this adapter.
	var connections = {};

	// You may also want to store additional, private data
	// per-connection (esp. if your data store uses persistent
	// connections).
	//
	// Keep in mind that models can be configured to use different databases
	// within the same app, at the same time.
	//
	// i.e. if you're writing a MariaDB adapter, you should be aware that one
	// model might be configured as `host="localhost"` and another might be using
	// `host="foo.com"` at the same time.  Same thing goes for user, database,
	// password, or any other config.
	//
	// You don't have to support this feature right off the bat in your
	// adapter, but it ought to get done eventually.
	//

	var adapter = {

		// Set to true if this adapter supports (or requires) things like data types, validations, keys, etc.
		// If true, the schema for models using this adapter will be automatically synced when the server starts.
		// Not terribly relevant if your data store is not SQL/schemaful.
		//
		// If setting syncable, you should consider the migrate option,
		// which allows you to set how the sync will be performed.
		// It can be overridden globally in an app (config/adapters.js)
		// and on a per-model basis.
		//
		// IMPORTANT:
		// `migrate` is not a production data migration solution!
		// In production, always use `migrate: safe`
		//
		// drop   => Drop schema and data, then recreate it
		// alter  => Drop/add columns as necessary.
		// safe   => Don't change anything (good for production DBs)
		//
		syncable: false,

		// Default configuration for connections
		defaults: {
			// For example, MySQLAdapter might set its default port and host.
			// port: 3306,
			host: 'http://local.raven.arhaus.com',
			database: 'OAuth_Prototype',
			schema: true
			// ssl: false,
			// customThings: ['eh']
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
		registerConnection: function(connection, collections, cb) {
			if (!connection.identity) {
				return cb(new Error('Connection is missing an identity.'));
			}
			if (connections[connection.identity]) {
				return cb(new Error('Connection is already registered.'));
			}

			var config = this.defaults ? _.extend({}, this.defaults, connection) : connection;
			connection.db = ravendb(connection.host, connection.database);

			// Add in logic here to initialize connection
			// e.g. connections[connection.identity] = new Database(connection, collections);
			connections[connection.identity] = connection;
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
		teardown: function(conn, cb) {

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
		describe: function(connection, collection, cb) {
			// Add in logic here to describe a collection (e.g. DESCRIBE TABLE logic)
			return cb();
		},

		/**
		 *
		 * REQUIRED method if integrating with a schemaful
		 * (SQL-ish) database.
		 *
		 */
		define: function(connection, collection, definition, cb) {
			// Add in logic here to create a collection (e.g. CREATE TABLE logic)
			return cb();
		},

		/**
		 *
		 * REQUIRED method if integrating with a schemaful
		 * (SQL-ish) database.
		 *
		 */
		drop: function(connection, collection, relations, cb) {
			// Add in logic here to delete a collection (e.g. DROP TABLE logic)
			return cb();
		},

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
		find: function(connection, collection, options, cb) {
			var db = connections[connection].db;
			var filter = options.where || options;
			db.queryIndex(filter, cb);
		},

		findOne: function(connection, collection, options, cb) {
			var db = connections[connection].db;
			var filter = options.where || options;
			if (filter.id) {
				db.getDocument(filter.id, cb);
			}
			db.queryIndex(filter, cb);
			// db.query(filter, 0, 1024, function(err, data) {
			// 	var body = JSON.parse(data.body);
			// 	var results = body.Results
			// 	if (results instanceof Array) {
			// 		cb(err, results[0]);
			// 	} else {
			// 		cb(err, results);
			// 	}
			// });
		},

		create: function(connection, collection, value, cb) {
			var db = connections[connection].db;
			if (value instanceof Array) {
				async.mapSeries(values, function(val, callback) {
					var obj = Document.fromObject(val, collection);
					db.saveDocument(collection, obj, function(err, doc) {
						callback(err, doc);
					});
				}, function(err, results) {
					cb(err, results);
				});
			} else {
				var obj = Document.fromObject(value, collection);
				db.saveDocument(collection, obj, cb);
			}
		},

		update: function(connection, collection, options, values, cb) {
			var db = connections[connection].db;
			if (value instanceof Array) {
				async.mapSeries(values, function(val, callback) {
					var obj = Document.fromObject(val, collection);
					db.saveDocument(collection, obj, function(err, doc) {
						callback(err, doc);
					});
				}, function(err, results) {
					cb(err, results);
				});
			} else {
				var obj = Document.fromObject(value, collection);
				db.saveDocument(collection, obj, cb);
			}
		},

		destroy: function(connection, collection, options, values, cb) {
			var db = connections[connection].db;
			var filter = options.where || options;
			db.queryIndex(filter, function(err, docs) {
				async.map(docs, function(doc, callback) {
					db.deleteDocument(doc['@metadata']['@id'], callback);
				}, function(err, deleted) {
					cb(err, deleted);
				});
			});
		}

		/*

		// Custom methods defined here will be available on all models
		// which are hooked up to this adapter:
		//
		// e.g.:
		//
		foo: function (collectionName, options, cb) {
			return cb(null,"ok");
		},
		bar: function (collectionName, options, cb) {
			if (!options.jello) return cb("Failure!");
			else return cb();
			destroy: function (connection, collection, options, values, cb) {
			 return cb();
		 }

		// So if you have three models:
		// Tiger, Sparrow, and User
		// 2 of which (Tiger and Sparrow) implement this custom adapter,
		// then you'll be able to access:
		//
		// Tiger.foo(...)
		// Tiger.bar(...)
		// Sparrow.foo(...)
		// Sparrow.bar(...)

		// Example success usage:
		//
		// (notice how the first argument goes away:)
		Tiger.foo({}, function (err, result) {
			if (err) return console.error(err);
			else console.log(result);

			// outputs: ok
		});

		// Example error usage:
		//
		// (notice how the first argument goes away:)
		Sparrow.bar({test: 'yes'}, function (err, result){
			if (err) console.error(err);
			else console.log(result);

			// outputs: Failure!
		})
		*/
	};

	// Expose adapter definition
	return adapter;
})();
