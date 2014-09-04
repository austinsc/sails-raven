![image_squidhome@2x.png](http://i.imgur.com/RIvu9.png)

# sails-raven

Provides easy access to RavenDB from Sails.js & Waterline. Currently a work in progress, see the #Status section below for more detail.

This module is a Waterline/Sails adapter, an early implementation of a rapidly-developing, tool-agnostic data standard.  Its goal is to provide a set of declarative interfaces, conventions, and best-practices for integrating with all sorts of data sources.  Not just databases-- external APIs, proprietary web services, or even hardware.

Strict adherence to an adapter specification enables the (re)use of built-in generic test suites, standardized documentation, reasonable expectations around the API for your users, and overall, a more pleasant development experience for everyone.


### Installation

To install this adapter, run in your sails project root folder:

```sh
$ npm install sails-raven
```

### Usage

```javascript
// Config sample: connections.js
module.exports.connections = {
  ravenDbServer: {
    adapter: 'sails-raven',
    host: 'http://raven.example.com',
    database: 'SomeProjectDatabase',
    port: 8080
  }
};
```


### Development Status
- **WIP** - Completing the base adapter implementation for common CRUD operations
- **TODO** - Create the queryable interface
- **TODO** - Map the queryable interface against lucene/RavenDB HTTP API
- **TODO** - Implement more features of the `Models.Attributes` Waterline API
- **TODO** - Create RavenDB indexes based on the Model Schema




### License

**[MIT](./LICENSE)**

[Sails](http://sailsjs.org) is free and open-source under the [MIT License](http://sails.mit-license.org/).

[RavenDB](http://ravendb.org)
