Feature: Payloads Controller

  Scenario: Register a DummyTemp payload
    Given I send the following "dummy-temp" payloads:
      | deviceEUI | temperature |
      | "12345"   | 21          |
      | "12345"   | 42          |
    Then The document "device-manager":"devices":"DummyTemp-12345" content match:
      | reference                               | "12345"       |
      | model                                   | "DummyTemp"   |
      | measures.temperature.type               | "temperature" |
      | measures.temperature.measuredAt         | "_DATE_NOW_"  |
      | measures.temperature.values.temperature | 42            |
      | engineId                                | null          |
      | assetId                                 | null          |

  Scenario: Reject if measuredAt is not unix timestamp
    Given I try to send the following "dummy-temp" payloads:
      | deviceEUI | temperature | measuredAt |
      | "12345"   | 21          | 1671007889 |
    Then I should receive an error matching:
      | message | "Invalid payload: \"measuredAt\" should be a timestamp in milliseconds" |

  Scenario: Reject with error a DummyTemp payload
    Given I try to send the following "dummy-temp" payloads:
      | deviceEUI | temperature |
      | null      | 21          |
    Then I should receive an error matching:
      | message | "Invalid payload: missing \"deviceEUI\"" |

  Scenario: Reject a DummyTemp payload
    Given I send the following "dummy-temp" payloads:
      | deviceEUI | temperature | invalid |
      | "12345"   | 21          | true    |
    Then I should receive a result matching:
      | valid | false |
    And The document "device-manager":"devices":"DummyTemp-12345" does not exists

  Scenario: Receive a payload with 3 measures
    Given I send the following "dummy-temp-position" payloads:
      | deviceEUI | temperature | location.lat | location.lon | location.accuracy | battery |
      | "12345"   | 21          | 42.2         | 2.42         | 2100              | 0.8     |
    Then The document "device-manager":"devices":"DummyTempPosition-12345" content match:
      | reference                               | "12345"             |
      | model                                   | "DummyTempPosition" |
      | measures.temperature.type               | "temperature"       |
      | measures.temperature.measuredAt         | "_DATE_NOW_"        |
      | measures.temperature.values.temperature | 21                  |
      | measures.position.type                  | "position"          |
      | measures.position.measuredAt            | "_DATE_NOW_"        |
      | measures.position.values.position.lat   | 42.2                |
      | measures.position.values.position.lon   | 2.42                |
      | measures.position.values.accuracy       | 2100                |
      | measures.battery.type                   | "battery"           |
      | measures.battery.measuredAt             | "_DATE_NOW_"        |
      | measures.battery.values.battery         | 80                  |
      | engineId                                | null                |
      | assetId                                 | null                |

  Scenario: Historize the measures with device and asset context
    Given I send the following "dummy-temp" payloads:
      | deviceEUI | "12345" |
      | "linked1" | 42.2    |
    And I refresh the collection "engine-ayse":"measures"
    Then When I successfully execute the action "document":"search" with args:
      | index      | "engine-ayse" |
      | collection | "measures"    |
    And I should receive a result matching:
      | hits[0]._source.type                  | "temperature"       |
      | hits[0]._source.measuredAt            | "_DATE_NOW_"        |
      | hits[0]._source.origin._id            | "DummyTemp-linked1" |
      | hits[0]._source.origin.type           | "device"            |
      | hits[0]._source.origin.measureName    | "temperature"       |
      | hits[0]._source.origin.deviceModel    | "DummyTemp"         |
      | hits[0]._source.origin.reference      | "linked1"           |
      | hits[0]._source.asset._id             | "Container-linked1" |
      | hits[0]._source.asset.measureName     | "temperatureExt"    |
      | hits[0]._source.asset.metadata.weight | 10                  |
      | hits[0]._source.asset.metadata.height | 11                  |

  Scenario: Decode Device metadata from payload
    Given I send the following "dummy-temp" payloads:
      | deviceEUI | temperature | metadata.color |
      | "12345"   | 21.1        | "RED"          |
    Then The document "device-manager":"devices":"DummyTemp-12345" content match:
      | reference      | "12345"     |
      | model          | "DummyTemp" |
      | metadata.color | "RED"       |

  Scenario: Throw an error when decoding unknown measure name
    Given I successfully execute the action "device-manager/devices":"create" with args:
      | engineId       | "device-manager" |
      | body.model     | "DummyTemp"      |
      | body.reference | "test"           |
    When I try to send the following "dummy-temp" payloads:
      | deviceEUI | temperature | unknownMeasure |
      | "12345"   | 21.1        | 42             |
    Then I should receive an error matching:
      | message | "Decoder \"DummyTemp\" has no measure named \"unknownMeasureName\"" |
    Then The document "device-manager":"devices":"DummyTemp-test" content match:
      | measures | {} |

  Scenario: Receive a payload from unknown device
    When I successfully execute the action "device-manager/payloads":"receiveUnknown" with args:
      | deviceModel    | "Abeeway" |
      | body.deviceEUI | "JORA"    |
    Then The last received payload match:
      | deviceModel       | "Abeeway" |
      | valid             | false     |
      | payload.deviceEUI | "JORA"    |
