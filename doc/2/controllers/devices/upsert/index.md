---
code: true
type: page
title: upsert
description: Update or Create a device
---

# upsert

Update or Create a device.
The Upsert operation allows you to create a new device or update an existing one if it already exists. This operation is useful when you want to ensure that an device is either created or updated in a single request.

## Query Syntax

### HTTP

```http
URL: http://kuzzle:7512/_/device-manager/:engineId/devices
Method: PUT
```

## Other protocols

```js
{
    "controller": "device-manager/devices",
    "action": "upsert",
    "engineId": "<engineId>",
    "reference": "<deviceReference>",
    "model": "<deviceModel>",
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
- `reference` : device reference
- `model`: device model

## Body properties

- `metadata`: Object containing metadata

---

## Response

```js
{
  "status": 200,
  "error": null,
  "controller": "device-manager/devices",
  "action": "update",
  "requestId": "<unique request identifier>",
  "result": {
    "_id": "<deviceId>",
    "_source": {
      // device content
    },
  }
}
```
