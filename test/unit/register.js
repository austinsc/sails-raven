/**
 * Test dependencies
 */
var Adapter = require('../../SailsRaven.js');
var query = require('../../lib/query.js');

describe('registerConnection', function () {

  // it('should not hang or encounter any errors', function (done) {
  //   Adapter.registerConnection({
  //     identity: 'foo'
  //   }, done);
  // });

  // e.g.
  // it('should create a mysql connection pool', function () {})
  // it('should create an HTTP connection pool', function () {})
  // ... and so on.
});

describe('query', function () {
  it('should create a valid lucene query string', function (done) {
    var q = query()
      .from("Products")
      .index("Type", "Chair")
      .where("Model").equals("Accord")
      .orderBy("PartNumber")
      .success(function () {
        done();
      }).error(function (err) {
        assert.fail(err, null, err);
      }).select();
  });
});
