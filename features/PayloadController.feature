Feature: Payloads Controller

  Scenario: Register a DummyTemp payload
    When I successfully receive a "dummy-temp" payload with:
      | deviceEUI    | "12345" |
      | register55   | 23.3    |
      | batteryLevel | 0.8     |
    Then The document "device-manager":"sensors":"DummyTemp_12345" content match:
      | reference                        | "12345"       |
      | model                            | "DummyTemp"   |
      | measures.temperature.updatedAt   | "_DATE_NOW_"  |
      | measures.temperature.payloadUuid | "_STRING_"    |
      | measures.temperature.degree      | 23.3          |
      | qos.battery                      | 80            |
      | tenantId                         | "_UNDEFINED_" |
      | assetId                          | "_UNDEFINED_" |

  Scenario: Update a DummyTemp payload
    Given I successfully receive a "dummy-temp" payload with:
      | deviceEUI    | "12345" |
      | register55   | 23.3    |
      | batteryLevel | 0.8     |
    When I successfully receive a "dummy-temp" payload with:
      | deviceEUI    | "12345" |
      | register55   | 42.2    |
      | batteryLevel | 0.7     |
    Then The document "device-manager":"sensors":"DummyTemp_12345" content match:
      | reference                        | "12345"       |
      | model                            | "DummyTemp"   |
      | measures.temperature.updatedAt   | "_DATE_NOW_"  |
      | measures.temperature.payloadUuid | "_STRING_"    |
      | measures.temperature.degree      | 42.2          |
      | qos.battery                      | 70            |
      | tenantId                         | "_UNDEFINED_" |
      | assetId                          | "_UNDEFINED_" |

  Scenario: Validate a DummyTemp payload
    When I receive a "dummy-temp" payload with:
      | deviceEUI    | null |
      | register55   | 42.2 |
      | batteryLevel | 0.7  |
    Then I should receive an error matching:
      | message | "Invalid payload: missing \"deviceEUI\"" |

  Scenario: Receive a payload with 2 measures
    When I successfully receive a "dummy-temp-position" payload with:
      | deviceEUI     | "12345" |
      | register55    | 23.3    |
      | location.lat  | 42.2    |
      | location.lon  | 2.42    |
      | location.accu | 2100    |
    Then The document "device-manager":"sensors":"DummyTempPosition_12345" content match:
      | reference                        | "12345"             |
      | model                            | "DummyTempPosition" |
      | measures.temperature.updatedAt   | "_DATE_NOW_"        |
      | measures.temperature.payloadUuid | "_STRING_"          |
      | measures.temperature.degree      | 23.3                |
      | measures.position.updatedAt      | "_DATE_NOW_"        |
      | measures.position.payloadUuid    | "_STRING_"          |
      | measures.position.point.lat      | 42.2                |
      | measures.position.point.lon      | 2.42                |
      | measures.position.accuracy       | 2100                |
      | qos.battery                      | 80                  |
      | tenantId                         | "_UNDEFINED_"       |
      | assetId                          | "_UNDEFINED_"       |

  Scenario: Enrich tag with beforeRegister and beforeUpdate hooks
    When I successfully receive a "dummy-temp" payload with:
      | deviceEUI    | "12345" |
      | register55   | 23.3    |
      | batteryLevel | 0.8     |
    Then The document "device-manager":"sensors":"DummyTemp_12345" content match:
      | qos.registerEnriched | true          |
      | qos.updateEnriched   | "_UNDEFINED_" |
    # Update
    When I successfully receive a "dummy-temp" payload with:
      | deviceEUI    | "12345" |
      | register55   | 23.3    |
      | batteryLevel | 0.8     |
    Then The document "device-manager":"sensors":"DummyTemp_12345" content match:
      | qos.registerEnriched | true |
      | qos.updateEnriched   | true |

  Scenario: Execute afterRegister and afterUpdate hooks
    When I successfully receive a "dummy-temp" payload with:
      | deviceEUI    | "12345" |
      | register55   | 23.3    |
      | batteryLevel | 0.8     |
    Then I should receive a result matching:
      | afterRegister | true |
    # Update
    When I successfully receive a "dummy-temp" payload with:
      | deviceEUI    | "12345" |
      | register55   | 23.3    |
      | batteryLevel | 0.8     |
    Then I should receive a result matching:
      | afterUpdate | true |

  Scenario: Propagate sensor to tenant index
    When I successfully receive a "dummy-temp" payload with:
      | deviceEUI    | "attached-ayse-unlinked" |
      | register55   | 42.2                     |
      | batteryLevel | 0.4                      |
    Then The document "device-manager":"sensors":"DummyTemp_attached-ayse-unlinked" content match:
      | tenantId                         | "tenant-ayse" |
      | measures.temperature.updatedAt   | "_DATE_NOW_"  |
      | measures.temperature.payloadUuid | "_STRING_"    |
      | measures.temperature.degree      | 42.2          |
      | qos.battery                      | 40            |
    And The document "tenant-ayse":"sensors":"DummyTemp_attached-ayse-unlinked" content match:
      | tenantId                         | "tenant-ayse" |
      | measures.temperature.updatedAt   | "_DATE_NOW_"  |
      | measures.temperature.payloadUuid | "_STRING_"    |
      | measures.temperature.degree      | 42.2          |
      | qos.battery                      | 40            |

  Scenario: Propagate sensor measures to asset
    Given I successfully execute the action "device-manager/sensor":"linkAsset" with args:
      | _id     | "DummyTemp_attached-ayse-unlinked" |
      | assetId | "PERFO-unlinked"                   |
    When I successfully receive a "dummy-temp" payload with:
      | deviceEUI    | "attached-ayse-unlinked" |
      | register55   | 42.2                     |
      | batteryLevel | 0.4                      |
    Then The document "device-manager":"sensors":"DummyTemp_attached-ayse-unlinked" content match:
      | tenantId | "tenant-ayse"    |
      | assetId  | "PERFO-unlinked" |
    Then The document "tenant-ayse":"sensors":"DummyTemp_attached-ayse-unlinked" content match:
      | tenantId | "tenant-ayse"    |
      | assetId  | "PERFO-unlinked" |
    And The document "tenant-ayse":"assets":"PERFO-unlinked" content match:
      | measures.temperature.id          | "DummyTemp_attached-ayse-unlinked" |
      | measures.temperature.reference   | "attached-ayse-unlinked"           |
      | measures.temperature.model       | "DummyTemp"                        |
      | measures.temperature.updatedAt   | "_DATE_NOW_"                       |
      | measures.temperature.payloadUuid | "_STRING_"                         |
      | measures.temperature.degree      | 42.2                               |
      | measures.temperature.qos.battery | 40                                 |
    And I refresh the collection "tenant-ayse":"assets-history"
    And I count 1 documents in "tenant-ayse":"assets-history"

