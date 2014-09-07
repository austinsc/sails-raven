var _ = require('lodash');
var linq = require('linq');

var Document = function Document(values, schema, collection) {
  // if (global.v8debug) {
  //   global.v8debug.Debug.setBreakOnException();
  // }
  var self = this;

  // Create the RavenDB Id prefix
  self['@prefix'] = collection.identity + '/';

  // Grab the schema for normalizing values
  self['@schema'] = schema || {};

  // if (values) {
  // Find the primary key and update the raven key
  var pkey = self['@pkey'] = linq.from(Object.keys(schema)).singleOrDefault(function (x) {
    return schema[x].primaryKey;
  });
  self.setMetadata(values['@metadata'] || {
    'Raven-Entity-Name': collection.globalId || collection.identity
  });
  //self.setMetadataValue('Key', self['@prefix']);

  // if (pkey && values[pkey]) {
  //   if (values[pkey].indexOf('\\') !== -1 || values[pkey].length > 1023) {
  //     throw new Error('Invalid primary key specified  -> ' + values[pkey]);
  //   } else {
  //     self.setMetadataValue('Key', self['@prefix'] + values[pkey]);
  //     // self.setMetadataValue('@id', self['@prefix'] + values[pkey]);
  //   }
  // } else {
  //   self.setMetadataValue('Key', self['@prefix']);
  // }

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
  // } else {
  //   self.setMetadata({
  //     'Raven-Entity-Name': collection.globalId || collection.identity
  //   });
  // }
  if ((self.getMetadataValue('@id') || self.getMetadataValue('__document_id')) && !self[self['@pkey']]) {
    self.setMetadataValue('@id', self['@metadata']['@id'] || self['@metadata']['__document_id']);
  }
  // if (pkey) {
  //   self.__defineGetter__(pkey, function () {
  //     return (self.getMetadata('@id') || self.getMetadata('__document_id') || self.getMetadata('Key')).slice(self['@prefix'].length);
  //   });
  //   self.__defineGetter__(pkey, function (value) {
  //     self.setMetadataValue('key', self['@prefix'] + value);
  //   });
  // }
  return this;
};

Document.prototype.getRavenKey = function () {
  if (this['@pkey'] && this[this['@pkey']]) {
    return this['@prefix'] + this[this['@pkey']];
  }
  return self.getMetadataValue('@id') || self.getMetadataValue('__document_id') || self.getMetadataValue('key') || this['@prefix'];
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
    return this[this['@pkey']] = value.slice(this['@prefix'].length);
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
