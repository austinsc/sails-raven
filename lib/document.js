var _ = require('lodash');
var linq = require('linq');

var Document = function Document(values, schema, collection) {
  var self = this;

  // Create the RavenDB Id prefix
  self['@prefix'] = collection.identity + '/';

  // Grab the schema for normalizing values
  self['@schema'] = schema || {};

  if (values) {
    // Find the primary key and update the raven key
    var pkey = self['@pkey'] = linq.from(Object.keys(self['@schema'])).singleOrDefault(function (x) {
      return schema[x].primaryKey;
    });
    self.setMetadata(values['@metadata'] || {
      'Raven-Entity-Name': collection.globalId || collection.identity
    });
    if (pkey && values[pkey]) {
      if (values[pkey].indexOf('\\') || values[pkey].length > 1023) {
        throw new Error('Invalid primary key specified.');
      } else {
        self.setMetadataValue('Key', self['@prefix'] + values[pkey]);
        self.setMetadataValue('@id', self['@prefix'] + values[pkey]);
      }
    } else {
      self.setMetadataValue('Key', self['@prefix']);
    }

    // Deserialize json properties
    linq.from(Object.keys(schema)).where(function (x) {
      return x.type === 'json';
    }).forEach(function (x) {
      if (_.isString(values[x])) {
        try {
          values[x] = JSON.parse(values[x]);
        } catch (e) {}
      }
    });

    // Filter out invalid properties and then copy them to self
    linq.from(Object.keys(values)).where(function (x) {
      return _.has(schema, x) || values[x] !== undefined;
    }).forEach(function (key) {
      self[key] = _.clone(values[key]);
    });
  } else {
    self.setMetadata({
      'Raven-Entity-Name': collection.globalId || collection.identity
    });
  }
  if ((self['@metadata']['@id'] || self['@metadata']['__document_id']) && !self[self['@pkey']]) {
    self.setMetadataValue('@id', self['@metadata']['@id'] || self['@metadata']['__document_id']);
  }
  return this;
};

Document.prototype.setMetadata = function setMetadata(metadata) {
  return this["@metadata"] = metadata;
};

Document.prototype.getMetadata = function getMetadata() {
  return this["@metadata"];
};

Document.prototype.getMetadataValue = function getMetadataValue(key) {
  return this.getMetadata()[key.toLowerCase()];
};

Document.prototype.setMetadataValue = function setMetadataValue(key, value) {
  key = key.toLowerCase();
  this["@metadata"][key] = value;
  if (value.indexOf(this['@prefix']) === 0) {
    var id = value.slice(this['@prefix'].length);
    this[this['@pkey']] = id;
    return id;
  }
  return value;
};

Document.prototype.setMetadataValues = function setMetadataValues(values) {
  var self = this;
  return Object.keys(values).map(function (key) {
    return self.setMetadataValue(key, values[key]);
  });
};

module.exports = Document;
