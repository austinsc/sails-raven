var _ = require('lodash');
var Document = function Document(values, schema, collection) {
  // Initialize the metadata
  this.setMetadata({
    'Raven-Entity-Name': collection.globalId
  });

  // Create the RavenDB Id prefix
  this.idprefix = collection.identifier + '/';

  // Grab the schema for normalizing values
  this.schema = schema || {};

  // If values were passed in, use the setter
  if (values) {
    var vals = this.setValues(values);
    Object.keys(vals).forEach(function (key) {
      this[key] = _.clone(vals[key]);
    });
  }

  return this;
};

/**
 * Set values
 *
 * Normalizes values into proper formats.
 *
 * @param {Object} values
 * @return {Object}
 * @api private
 */
Document.prototype.setValues = function setValues(values) {
  this.serializeValues(values);
  this.normalizeId(values);

  return values;
};

/**
 * Normalize ID's
 *
 * Moves values.id into the preferred mongo _id field.
 *
 * @param {Object} values
 * @api private
 */
Document.prototype.normalizeId = function normalizeId(values) {
  if (values.id) {
    // Check if data.id looks like a RavenDB Id
    if (values.id.indexOf(this.idprefix) !== 0) {
      values.id = this.idprefix + values.id;
    }

    // Set the metadata 'key' value to the id
    this.setMetadataValue('Key', values.id);
  }
};

/**
 * Serialize Insert Values
 *
 * @param {Object} values
 * @return {Object}
 * @api private
 */

Document.prototype.serializeValues = function serializeValues(values) {
  var self = this;

  Object.keys(values).forEach(function (key) {
    // Skip values not in the schema
    if (!hasOwnProperty(self.schema, key)) {
      return;
    }

    // Skip undefined values
    if (_.isUndefined(values[key])) {
      return;
    }

    // Skip null values
    if (_.isNull(values[key])) {
      return;
    }

    if (self.schema[key].type === 'json' && _.isString(values[key])) {
      try {
        values[key] = JSON.parse(values[key]);
      } catch (e) {
        return;
      }
    }
  });

  return values;
};

Document.prototype.setMetadata = function (metadata) {
  return this["@metadata"] = metadata;
};

Document.prototype.getMetadata = function () {
  return this["@metadata"];
};

Document.prototype.getMetadataValue = function (key) {
  return this.getMetadata()[key.toLowerCase()];
};

Document.prototype.setMetadataValue = function (key, value) {
  return this.getMetadata()[key.toLowerCase()] = value;
};

Document.prototype.setMetadataValues = function (values) {
  return Object.keys(values).map(function (key) {
    return this.setMetadataValue(key, values[key]);
  });
};

module.exports = Document;
