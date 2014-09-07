var Database = require('./database');
var Datastore = function Datastore(url) {
  this.url = url || 'http://localhost:8080';
  this.defaultDatabase = new Database(this, 'Default');
  this.databases = {
    'Default': this.defaultDatabase
  };
};

Datastore.prototype.useDatabase = function (name) {
  this.currentDatabase = this.databases[name] || (this.databases[name] = new Database(this, name));
  return this.currentDatabase;
};

Datastore.prototype.useDefaultDatabase = function () {
  return this.useDatabase('Default');
};

Datastore.prototype.createDatabase = function (name, dataDirectory, cb) {
  if (typeof dataDirectory === 'function') {
    cb = dataDirectory;
    dataDirectory = "~/Tenants/" + name;
  }
  return this.defaultDatabase.saveDocument(null, {
    id: "Raven/Databases/" + name,
    'Settings': {
      'Raven/DataDir': dataDirectory
    }
  }, function (error, result) {
    return cb(error, result);
  });
};

Datastore.prototype.deleteDatabase = function (name, cb) {
  return this.defaultDatabase.deleteDocument("Raven/Databases/" + name, function (error, result) {
    return cb(error, result);
  });
};

module.exports = Datastore;
