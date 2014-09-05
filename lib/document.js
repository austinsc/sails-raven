var _ = require('lodash');
var linq = require('linq');

var Document = function Document(values, schema, collection) {
  // Ensure we are not rewrapping an instance of Document multiple times
  if (values instanceof Document) {
    return values;
  }

  var self = this;

  // Initialize the metadata
  self.setMetadata({
    'Raven-Entity-Name': collection.globalId || collection.identity
  });

  // Grab the schema for normalizing values
  self['@schema'] = schema || {};

  // Create the RavenDB Id prefix
  self['@prefix'] = collection.identity + '/';

  if (values) {
    // Find the primary key and update the raven key
    var pkey = self['@pkey'] = linq.from(Object.keys(self['@schema'])).singleOrDefault(function (x) {
      return self['@schema'][x].primaryKey;
    });
    if (pkey && values[pkey]) {
      if (values[pkey].indexOf('\\') || values[pkey].length > 1023) {
        throw new Error('Invalid primary key specified.');
      } else {
        self.setMetadataValue('Key', self['@prefix'] + values[pkey]);
      }
    } else {
      self.setMetadataValue('Key', self['@prefix']);
    }

    // Deserialize json properties
    linq.from(Object.keys(self['@schema'])).where(function (x) {
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
      return _.has(self['@schema'], x) || values[x] !== undefined;
    }).forEach(function (key) {
      self[key] = _.clone(values[key]);
    });
  }

  return self;
};

Document.prototype.updatePrimaryKey = function updatePrimaryKey() {
  peek(this['@pkey'] + ": " + this[this['@pkey']]);
  var ravenid = this.getMetadataValue('@id') || this.getMetadataValue('key');
  if (this['@pkey'] && ravenid) {
    this[this['@pkey']] = ravenid.replace(this['@prefix'], '');
  }
  peek(this['@pkey'] + ": " + this[this['@pkey']]);
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
  this.getMetadata()[key] = value;
  if (key === 'key' || key === '@id') {
    this.updatePrimaryKey();
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
