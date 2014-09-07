var Datastore = require('./datastore');

var ravendb = function (datastoreUrl, databaseName) {
  var ds = new Datastore(datastoreUrl);
  return ds.useDatabase(databaseName || 'Default');
};

ravendb.Datastore = Datastore;
ravendb.Database = require('./database');
ravendb.Document = require('./document');

module.exports = ravendb;
