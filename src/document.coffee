_ = require 'lodash'

class Document
  @fromObject: (object) ->
    if object.getMetadataValue
      doc = new Document()
      _.extend(doc, object)
      doc.setMetadataValue("Key", doc.id) if doc.id
      doc
    else
      object

  constructor: ->
    @setMetadata({})

  setMetadata: (metadata) ->
    @["@metadata"] = metadata

  getMetadata: ->
    @["@metadata"]

  getMetadataValue: (key) ->
    @getMetadata()[key.toLowerCase()]

  setMetadataValue: (key, value) ->
    @getMetadata()[key.toLowerCase()] = value

  setMetadataValues: (object) ->
    @setMetadataValue(key, value) for key, value of object


module.exports = Document
