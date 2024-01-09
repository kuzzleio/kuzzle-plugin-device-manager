---
code: true
type: page
title: upsert
description: Update or Create an asset
---

# upsert

Update or Create an asset.
The Upsert operation allows you to create a new asset or update an existing one if it already exists. This operation is useful when you want to ensure that an asset is either created or updated in a single request.

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_/device-manager/:engineId/assets/:_id
Method: POST
```

## Other protocols

```js
{
    "controller": "device-manager/assets",
    "action": "upsert",
    "engineId": "<engineId>",
    "_id": "<assetId>",
    "body": {
        "metadata": {
            "<metadata name>": "<metadata value>"
        }
    }
}
```

---

## Arguments

- `engineId`: Engine ID
- `_id`: Asset ID

## Body properties

- `metadata`: Object containing metadata

---

## Response

```js
{
  "status": 200,
  "error": null,
  "controller": "device-manager/assets",
  "action": "update",
  "requestId": "<unique request identifier>",
  "result": {
    "_id": "<assetId>",
    "_source": {
      // Asset content
    },
  }
}
```