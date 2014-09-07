var _ = require('lodash');
var Api = require('./api');
var async = async || require('async');

function Database(datastore, name, apiProvider) {
  this.datastore = datastore;
  this.name = name;
  if (!apiProvider) {
    apiProvider = Api;
  }
  this.api = new apiProvider(this.datastore.url, this.name);
}

Database.prototype.getCollections = function (cb) {
  this.apiGet(this.getTermsUrl(Database.DOCUMENTS_BY_ENTITY_NAME_INDEX, 'Tag'), function (error, response) {
    if (!error && response.statusCode === 200) {
      if (cb) {
        return cb(null, JSON.parse(response.body));
      }
    } else if (cb) {
      return cb(error);
    }
  });
  return null;
};

Database.prototype.saveDocument = function (doc, cb) {
  var key = doc.getMetadataValue('key');
  var url = this.getDocsUrl() + '/' + key;
  var op = key.indexOf('/') === key.length - 1 ? this.apiPut : this.apiPost;
  op.call(this, url, doc, doc.getMetadata(), function (error, response) {
    if (!error && response.statusCode === 201) {
      var body = JSON.parse(response.body);
      if (body.Key) {
        body['@id'] = body.Key;
      }
      doc.setMetadataValues(body);
      return cb(null, doc);
    } else {
      return cb(error || new Error('Unable to create document: ' + response.statusCode + ' - ' + response.body));
    }
  });
};

Database.prototype.getDocument = function (id, cb) {
  var url = this.getDocUrl(id);
  this.apiGet(url, function (error, response) {
    if (!error && response.statusCode === 200) {
      var body = JSON.parse(response.body);
      body['@metadata'] = response.headers || {};
      return cb(null, body);
    } else {
      return cb(error);
    }
  });
};

Database.prototype.find = function (filter, cb) {
  var self = this;
  this.queryByIndex(Database.DYNAMIC_INDEX, filter, filter.skip || 0, filter.limit || 1024, function (err, response) {
    if (err) {
      cb(err);
    }
    try {
      var body = JSON.parse(response.body);
      if (body.Error) {
        cb(body.Error);
      } else if (body.IsStale === true) {
        self.__waitForIndex(filter, cb);
      } else if (body.IsStale === false) {
        cb(null, body.Results);
      } else {
        cb(new Error('Something bad happened with the query: ' + err));
      }
    } catch (e) {
      cb(e);
    }
  });
};

Database.prototype.deleteDocument = function (id, cb) {
  if (id === null || id === undefined) {
    cb(new Error('Invalid Id'));
  } else {
    var url = this.getDocUrl(id);
    this.apiDelete(url, function (error, response) {
      if (!error && response.statusCode === 204) {
        return cb(null, response.body);
      } else {
        if (error) {
          return cb(error);
        } else {
          return cb(new Error('Unable to delete document: ' + response.statusCode + ' - ' + response.body));
        }
      }
    });
  }
};

Database.prototype.getDocsInCollection = function (collection, start, count, cb) {
  if (typeof start === 'function') {
    cb = start;
    start = null;
    count = null;
  } else if (typeof count === 'function') {
    cb = count;
    count = null;
  }
  this.queryRavenDocumentsByEntityName(collection, start, count, function (error, results) {
    if (!error) {
      results = JSON.parse(results.body);
    }
    return cb(error, results && results.Results);
  });
};

Database.prototype.getDocumentCount = function (collection, cb) {
  this.queryRavenDocumentsByEntityName(collection, 0, 0, function (error, response) {
    if (error) {
      cb(error, null);
      return;
    }
    var manufacturedError = new Error("Unable to get document count: " + response.statusCode + " - " + response.body);
    if (response.statusCode >= 400) {
      cb(manufacturedError, null);
      return;
    }
    var results = JSON.parse(response.body);
    if (results && results.TotalResults) {
      cb(null, results.TotalResults);
    } else {
      cb(manufacturedError, null);
    }
  });
};

Database.prototype.getStats = function (cb) {
  this.apiGet(this.getStatsUrl(), function (error, results) {
    var stats;
    if (!error) {
      stats = JSON.parse(results.body);
    }
    return cb(error, stats);
  });
};

Database.prototype.__waitForIndex = function (filter, cb) {
  var self = this;
  setTimeout(function () {
    self.find(filter, cb);
  }, 50);
};

Database.prototype.queryRavenDocumentsByEntityName = function (name, start, count, cb) {
  var search = name ? {
    Tag: name
  } : null;
  return this.queryByIndex(Database.DOCUMENTS_BY_ENTITY_NAME_INDEX, search, start, count, cb);
};

Database.prototype.queryByIndex = function (index, query, start, count, orderby, cb) {
  if (start === null) {
    start = 0;
  }
  if (count === null) {
    count = 25;
  }
  if (orderby === null) {
    orderby = null;
  }
  if (typeof start === 'function') {
    cb = start;
    start = null;
    count = null;
  } else if (typeof count === 'function') {
    cb = count;
    count = null;
  } else if (typeof orderby === 'function') {
    cb = orderby;
    orderby = null;
  }
  var url = (this.getIndexUrl(index)) + "?start=" + start + "&pageSize=" + count + "&aggregation=None";
  if (query) {
    url += "&query=" + (this.luceneQueryArgs(query));
  }
  if (orderby) {
    url += "&sort=" + orderby;
  }
  return this.apiGet(url, cb);
};

Database.prototype.createIndex = function (name, map, reduce, cb) {
  if (typeof reduce === 'function') {
    cb = reduce;
    reduce = null;
  }
  var url = this.getIndexUrl(name);
  var index = {
    Map: map
  };
  if (reduce) {
    index['Reduce'] = reduce;
  }
  return this.apiPut(url, index, function (error, response) {
    var _ref;
    if (!error && response.statusCode === 201) {
      if (cb) {
        return cb(null, JSON.parse(response.body));
      }
    } else {
      if (cb) {
        if (error) {
          return cb(error);
        } else {
          return cb(new Error('Unable to create index: ' + response.statusCode + ' - ' + response.body));
        }
      }
    }
  });
};

Database.prototype.deleteIndex = function (index, cb) {
  var url = this.getIndexUrl(index);
  return this.apiDelete(url, function (error, response) {
    var _ref;
    if (!error && response.statusCode === 204) {
      if (cb) {
        return cb(null, JSON.parse(response.body));
      }
    } else {
      if (cb) {
        if (error) {
          return cb(error);
        } else {
          return cb(new Error('Unable to delete index: ' + response.statusCode + ' - ' + response.body));
        }
      }
    }
  });
};

Database.prototype.saveAttachment = function (docId, content, headers, cb) {
  var url = this.getAttachmentUrl(docId);
  return this.apiPut(url, content, headers, function (error, response) {
    var _ref;
    if (!error && response.statusCode === 201) {
      if (cb) {
        return cb(null, JSON.parse(response.body));
      }
    } else {
      if (cb) {
        if (error) {
          return cb(error);
        } else {
          return cb(new Error('Unable to save attachment: ' + response.statusCode + ' - ' + response.body));
        }
      }
    }
  });
};

Database.prototype.getAttachment = function (id, cb) {
  var url = this.getAttachmentUrl(id);
  return this.apiGet(url, function (error, response) {
    if (!error && response.statusCode === 200) {
      return cb(null, response);
    } else {
      return cb(error);
    }
  });
};

Database.prototype.deleteAttachment = function (id, cb) {
  var url = this.getAttachmentUrl(id);
  return this.apiDelete(url, function (error, response) {
    if (!error && response.statusCode === 204) {
      if (cb) {
        return cb(null, response.body);
      }
    } else {
      if (cb) {
        if (error) {
          return cb(error);
        } else {
          return cb(new Error('Unable to delete attachment: ' + response.statusCode + ' - ' + response.body));
        }
      }
    }
  });
};

Database.prototype.luceneQueryArgs = function (query) {
  return this.api.luceneQueryArgs(query);
};

Database.prototype.useRavenHq = function (apiKey, cb) {
  return this.api.useRavenHq(apiKey, function (error, authorizationHeaderValue) {
    this.setAuthorization(authorizationHeaderValue);
    if (cb) {
      return cb(error, authorizationHeaderValue);
    }
  });
};

Database.prototype.apiGet = function (url, headers, cb) {
  return this.api.get(url, headers, cb);
};

Database.prototype.apiPut = function (url, body, headers, cb) {
  return this.api.put(url, body, headers, cb);
};

Database.prototype.apiPost = function (url, body, headers, cb) {
  return this.api.post(url, body, headers, cb);
};

Database.prototype.apiPatch = function (url, body, headers, cb) {
  return this.api.patch(url, body, headers, cb);
};

Database.prototype.apiDelete = function (url, body, headers, cb) {
  return this.api["delete"](url, body, headers, cb);
};

Database.prototype.getUrl = function () {
  return this.api.getUrl();
};

Database.prototype.getDocsUrl = function () {
  return this.api.getDocsUrl();
};

Database.prototype.getDocUrl = function (id) {
  return this.api.getDocUrl(id);
};

Database.prototype.getIndexesUrl = function () {
  return this.api.getIndexesUrl();
};

Database.prototype.getIndexUrl = function (index) {
  return this.api.getIndexUrl(index);
};

Database.prototype.getTermsUrl = function (index, field) {
  return this.api.getTermsUrl(index, field);
};

Database.prototype.getStaticUrl = function () {
  return this.api.getStaticUrl();
};

Database.prototype.getAttachmentUrl = function (id) {
  return this.api.getAttachmentUrl(id);
};

Database.prototype.getQueriesUrl = function () {
  return this.api.getQueryiesUrl();
};

Database.prototype.getBulkDocsUrl = function () {
  return this.api.getBulkDocsUrl();
};

Database.prototype.getBulkDocsIndexUrl = function (index, query) {
  return this.api.getBulkDocsIndexUrl(index, query);
};

Database.prototype.getStatsUrl = function () {
  return this.api.getStatsUrl();
};

Database.prototype.setAuthorization = function (authValue) {
  return this.api.setAuthorization(authValue);
};

Database.prototype.setBasicAuthorization = function (username, password) {
  return this.api.setBasicAuthorization(username, password);
};

Database.prototype.setProxy = function (proxyUrl) {
  return this.api.setProxy(proxyUrl);
};

Database.DOCUMENTS_BY_ENTITY_NAME_INDEX = 'Raven/DocumentsByEntityName';
Database.DYNAMIC_INDEX = 'dynamic';

module.exports = Database;
