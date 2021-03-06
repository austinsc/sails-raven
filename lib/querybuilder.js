module.exports = (function () {
  var from,
    by,
    where,
    select,
    equals,
    is,
    success,
    error,
    index,
    orderby;
  var conditions = [];
  var searchedfields = [];
  var innerQuery;
  var cached,
    cacheid,
    cachedResults,
    invalidatedCache;
  var errormsg;

  var fn_from = function (query) {
    if (!query) {
      return from;
    }

    from = query;
    invalidatedCache = true;
    return this;
  };

  var fn_orderby = function (query) {
    orderby = query;
    invalidatedCache = true;
    return this;
  };

  var fn_orderbydesc = function (query) {
    return fn_orderby("-" + query);
  };

  var fn_cached = function (value) {
    if (value === undefined) {
      return cached;
    } else {
      cached = value;
    }
  };

  var fn_cacheid = function (value) {
    if (value === undefined) {
      return cacheid;
    } else {
      cacheid = value;
      invalidatedCache = false;
    }
  };

  var fn_equals = function (query) {
    if (where) {
      conditions.push(where + ":\"" + query + "\" ");
    }

    where = undefined; //reset
    invalidatedCache = true;
    return this;
  };

  var fn_notequals = function (query) {
    if (where) {
      conditions.push(" -" + where + ":\"" + query + "\" ");
    }

    where = undefined; //reset
    invalidatedCache = true;
    return this;
  };

  var fn_and = function (query) {
    where = " AND " + query;
    invalidatedCache = true;
    return this;
  };

  var fn_or = function (query) {
    where = " OR " + query;
    invalidatedCache = true;
    return this;
  };

  var fn_starts = function (query) {
    if (where) {
      conditions.push(where + ": *" + query + " ");
    }

    where = undefined; //reset
    invalidatedCache = true;
    return this;
  };

  var fn_ends = function (query) {
    if (where) {
      conditions.push(where + ":" + query + "* ");
    }

    where = undefined; //reset
    invalidatedCache = true;
    return this;
  };

  var fn_contains = function (query) {
    if (where) {
      conditions.push(where + ": *" + query + "* ");
    }

    where = undefined; //reset
    invalidatedCache = true;
    return this;
  };

  var fn_where = function (query) {
    where = query;
    if (!(query in searchedfields)) {
      searchedfields.push(query);
      searchedfields.sort();
    }

    invalidatedCache = true;
    return this;
  };

  var fn_index = function (indexfield, indexvalue) {
    if (!indexfield) {
      return index;
    }

    is = indexvalue;
    by = indexfield;
    invalidatedCache = true;
    return this;
  };

  var fn_error = function (callback) {
    if (callback === undefined) {
      return error;
    } else {
      error = callback;
    }
    invalidatedCache = true;
    return this;
  };

  var fn_success = function (callback) {
    if (callback === undefined) {
      return success;
    } else {
      success = callback;
    }
    invalidatedCache = true;
    return this;
  };

  var fn_select = function (cache) {
    cached = cache & !invalidatedCache;
    var index = getIndex();
    if (!innerQuery || invalidatedCache) {
      innerQuery = BuildLuceneQueryString();
    }
    db.Select(this);
    invalidatedCache = false;
    return this;
  };

  var fn_fetch = function (field, cache) {
    cached = cache;
    var index = getIndex();
    if (!innerQuery) {
      innerQuery = BuildLuceneQueryString();
      innerQuery += "&fetch=" + field;
    }
    db.Select(this);
    return this;
  };

  // Try to use pre-defined index; if not exists, use dynamic index instead
  function getIndex() {
    if (index) {
      return index;
    }

    if (from && by && searchedfields && conditions && is && success) {
      index = "ndx_for(" + by + "_is_" + is + ")_on_" + searchedfields.join();
    } else if (from && searchedfields && conditions && success) {
      index = "ndx_all_on_" + where;
    }

    if (index) {
      if (!database.HasIndex(index)) {
        // use dynamic index, and prepend static index constraint as query condition
        errormsg = "No such index: " + index;
        index = "dynamic";
        if (by && is) {
          conditions.unshift(by + ":\"" + is + "\" AND ");
        }
      }
    }

    return index;
  }

  function BuildLuceneQueryString() {
    var query = "";
    for (var c in conditions) {
      query += conditions[c];
    }

    query = encodeURIComponent(query);

    if (orderby) {
      query += "&sort=" + orderby;
    }

    return query;
  }

  /*
	Query pattern example:

	var q = Query()
	.from("Products")
	.index("Type","Chair")
	.where("Model").equals("Accord")
	.orderBy("PartNumber")
	.success(...).error(...)
	.select();
	*/

  var queryobject = {
    from: fn_from,
    index: fn_index,

    cached: fn_cached,
    cacheID: fn_cacheid,
    innerQuery: function () {
      return innerQuery;
    },

    and: fn_and,
    or: fn_or,
    where: fn_where,

    equals: fn_equals,
    not: fn_notequals,
    startsWith: fn_starts,
    endsWith: fn_ends,
    contains: fn_contains,

    select: fn_select,
    fetch: fn_fetch,

    orderBy: fn_orderby,
    orderByDesc: fn_orderbydesc,

    success: fn_success,
    error: fn_error,
    errorMsg: errormsg
  };

  return queryobject;
})();
