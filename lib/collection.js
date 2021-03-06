var _ = require('lodash'),
  linq = require('linq'),
  async = require('async'),
  Document = require('./document'),
  Query = require('./query'),
  Errors = require('waterline-errors').adapter;

/**
 * Manage A Collection
 *
 * @param {Object} definition
 * @api public
 */
var Collection = module.exports = function Collection(definition, connection) {
  // Set an identity for this collection
  this.identity = '';
  this.globalId = '';
  // Hold Schema Information
  this.schema = null;
  // Hold a reference to an active connection
  this.connection = connection;
  // Hold Indexes
  this.indexes = [];
  // Parse the definition into collection attributes
  this._parseDefinition(definition);
  // Build an indexes dictionary
  this._buildIndexes();

  return this;
};

/**
 * Find Documents
 *
 * @param {Object} criteria
 * @param {Function} cb
 * @api public
 */
Collection.prototype.find = function (criteria, cb) {
  var self = this;
  // Ignore `select` from waterline core
  if (typeof criteria === 'object') {
    delete criteria.select;
  }

  try {
    var db = this.connection.db;
    var query = new Query(criteria, this.schema);
    var where = query.criteria.where || {};

    if (where.id) {
      db.getDocument(this.identity + '/' + where.id, function (err, result) {
        //result['@metadata']['@id'] = where.id;
        cb(err, result && new Document(result, self.schema, self));
      });
    } else {
      db.find(where, function (err, results) {
        if (err) {
          cb(err);
        } else if (_.isArray(results)) {
          async.map(results, function (result, done) {
            done(null, result && new Document(result, self.schema, self));
          }, cb);
        } else {
          cb(null, results && new Document(results, self.schema, self));
        }
      });
    }
  } catch (err) {
    cb(err);
  }
};

/**
 * Save a document
 *
 * @param {Object|Array} values
 * @param {Function} cb
 * @api public
 */
Collection.prototype.create = function save(values, cb) {
  var self = this;

  // Normalize values to an array
  if (!_.isArray(values)) {
    values = [values];
  }

  // Build a Document and save it to the database
  async.map(values, function (value, done) {
    self.connection.db.saveDocument(new Document(value, self.schema, self), done);
  }, cb);
};

// /**
//  * Update Documents
//  *
//  * @param {Object} criteria
//  * @param {Object} values
//  * @param {Function} cb
//  * @api public
//  */
// Collection.prototype.update = function update(criteria, values, cb) {
//   var self = this,
//     query;

//   // Ignore `select` from waterline core
//   if (typeof criteria === 'object') {
//     delete criteria.select;
//   }

//   // Catch errors build query and return to the callback
//   try {
//     query = new Query(criteria, this.schema);
//   } catch (err) {
//     return cb(err);
//   }

//   values = new Document(values, this.schema).values;

//   // Mongo doesn't allow ID's to be updated
//   if (values.id) delete values.id;
//   if (values._id) delete values._id;

//   var collection = this.connection.db.collection(self.identity);

//   // Lookup records being updated and grab their ID's
//   // Useful for later looking up the record after an insert
//   // Required because options may not contain an ID
//   collection.find(query.criteria.where).toArray(function (err, records) {
//     if (err) return cb(err);
//     if (!records) return cb(Errors.NotFound);

//     // Build an array of records
//     var updatedRecords = [];

//     records.forEach(function (record) {
//       updatedRecords.push(record._id);
//     });

//     // Update the records
//     collection.update(query.criteria.where, {
//       '$set': values
//     }, {
//       multi: true
//     }, function (err, result) {
//       if (err) return cb(err);

//       // Look up newly inserted records to return the results of the update
//       collection.find({
//         _id: {
//           '$in': updatedRecords
//         }
//       }).toArray(function (err, records) {
//         if (err) return cb(err);
//         cb(null, utils.rewriteIds(records, self.schema));
//       });
//     });
//   });
// };

/**
 * Destroy Documents
 *
 * @param {Object} criteria
 * @param {Function} cb
 * @api public
 */
Collection.prototype.destroy = function destroy(criteria, cb) {
  var self = this;
  self.find(criteria, function (err, result_s) {
    var results;
    if (!_.isArray(result_s)) {
      results = [result_s];
    } else {
      results = result_s;
    }
    async.each(results, function (result, done) {
      self.connection.db.deleteDocument(result.getRavenKey(), done);
    }, function (err) {
      cb(err, results);
    });
  });
};

/**
 * Count Documents
 *
 * @param {Object} criteria
 * @param {Function} cb
 * @api public
 */

// Collection.prototype.count = function count(criteria, cb) {
//   var self = this;
//   var query;

//   // Ignore `select` from waterline core
//   if (typeof criteria === 'object') {
//     delete criteria.select;
//   }

//   // Catch errors build query and return to the callback
//   try {
//     query = new Query(criteria, this.schema);
//   } catch (err) {
//     return cb(err);
//   }

//   this.connection.db.collection(this.identity).count(query.criteria.where, function (err, count) {
//     return cb(err, count);
//   });
// };

/**
 * Get name of primary key field for this collection
 *
 * @return {String}
 * @api private
 */
Collection.prototype._getPK = function _getPK() {
  var self = this;
  Object.keys(this.schema).forEach(function (key) {
    if (self.schema[key].primaryKey) {
      return key;
    }
  });
};

/**
 * Parse Collection Definition
 *
 * @param {Object} definition
 * @api private
 */

Collection.prototype._parseDefinition = function _parseDefinition(definition) {
  var self = this,
    collectionDef = _.cloneDeep(definition);

  // Hold the Schema
  this.schema = collectionDef.definition;

  // Remove any Auto-Increment Keys
  Object.keys(this.schema).forEach(function (key) {
    if (self.schema[key].autoIncrement) {
      delete self.schema[key].autoIncrement;
    }
  });

  // Set the identity
  this.identity = _.clone(definition.identity);
  this.globalId = _.clone(definition.globalId);
};

/**
 * Build Internal Indexes Dictionary based on the current schema.
 *
 * @api private
 */
Collection.prototype._buildIndexes = function _buildIndexes() {
  var self = this;

  Object.keys(this.schema).forEach(function (key) {
    var index = {};
    var options = {};

    // Handle Unique Indexes
    if (self.schema[key].unique) {

      // Set the index sort direction, doesn't matter for single key indexes
      index[key] = 1;

      // Set the index options
      options.sparse = true;
      options.unique = true;

      // Store the index in the collection
      self.indexes.push({
        index: index,
        options: options
      });
      return;
    }

    // Handle non-unique indexes
    if (self.schema[key].index) {

      // Set the index sort direction, doesn't matter for single key indexes
      index[key] = 1;

      // Set the index options
      options.sparse = true;

      // Store the index in the collection
      self.indexes.push({
        index: index,
        options: options
      });
      return;
    }
  });
};
