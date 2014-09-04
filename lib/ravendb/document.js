(function () {
  var _ = require('lodash');
  var Document = (function () {
    Document.fromObject = function (object) {
      var doc;
      if (object.getMetadataValue) {
        doc = new Document();
        _.extend(doc, object);
        if (doc.id) {
          doc.setMetadataValue("Key", doc.id);
        }
        return doc;
      } else {
        return object;
      }
    };

    function Document() {
      this.setMetadata({});
    }

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

    Document.prototype.setMetadataValues = function (object) {
      var key, value, _results;
      _results = [];
      for (key in object) {
        value = object[key];
        _results.push(this.setMetadataValue(key, value));
      }
      return _results;
    };

    return Document;
  })();
  module.exports = Document;
}).call(this);
