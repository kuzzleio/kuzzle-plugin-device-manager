Feature: Device Manager sensor controller

  Scenario: Attach a sensor to a tenant
    Given an engine on index "tenant-kuzzle"
    When I successfully execute the action "device-manager/sensor":"attachTenant" with args:
      | _id   | "DummyTemp_detached" |
      | index | "tenant-kuzzle"      |
    Then The document "device-manager":"sensors":"DummyTemp_detached" content match:
      | tenantId | "tenant-kuzzle" |
    And The document "tenant-kuzzle":"sensors":"DummyTemp_detached" exists

  Scenario: Error when assigning a sensor to a tenant
    Given an engine on index "tenant-kuzzle"
    When I execute the action "device-manager/sensor":"attachTenant" with args:
      | _id   | "DummyTemp_detached" |
      | index | "tenant-kaliop"      |
    Then I should receive an error matching:
      | message | "Tenant \"tenant-kaliop\" does not have a device-manager engine" |
    And I successfully execute the action "device-manager/sensor":"attachTenant" with args:
      | _id   | "DummyTemp_detached" |
      | index | "tenant-kuzzle"      |
    When I execute the action "device-manager/sensor":"attachTenant" with args:
      | _id   | "DummyTemp_detached" |
      | index | "tenant-kuzzle"      |
    Then I should receive an error matching:
      | message | "Sensor \"DummyTemp_detached\" is already attached to a tenant" |

  Scenario: Detach sensor from a tenant
    Given an engine on index "tenant-kuzzle"
    And I successfully execute the action "device-manager/sensor":"attachTenant" with args:
      | _id   | "DummyTemp_detached" |
      | index | "tenant-kuzzle"      |
    When I successfully execute the action "device-manager/sensor":"detach" with args:
      | _id | "DummyTemp_detached" |
    Then The document "device-manager":"sensors":"DummyTemp_detached" content match:
      | tenantId | null |
    And The document "tenant-kuzzle":"sensors":"DummyTemp_detached" does not exists

  Scenario: Error when detaching from a tenant
    Given an engine on index "tenant-kuzzle"
    When I execute the action "device-manager/sensor":"detach" with args:
      | _id | "DummyTemp_detached" |
    Then I should receive an error matching:
      | message | "Sensor \"DummyTemp_detached\" is not attached to a tenant" |
    Given I successfully execute the action "device-manager/sensor":"linkAsset" with args:
      | _id     | "DummyTemp_attached-ayse-unlinked" |
      | assetId | "PERFO-unlinked"                   |
    When I execute the action "device-manager/sensor":"detach" with args:
      | _id | "DummyTemp_attached-ayse-unlinked" |
    Then I should receive an error matching:
      | message | "Sensor \"DummyTemp_attached-ayse-unlinked\" is still linked to an asset" |

  Scenario: Link sensor to an asset
    When I successfully execute the action "device-manager/sensor":"linkAsset" with args:
      | _id     | "DummyTemp_attached-ayse-unlinked" |
      | assetId | "PERFO-unlinked"                   |
    Then The document "device-manager":"sensors":"DummyTemp_attached-ayse-unlinked" content match:
      | assetId | "PERFO-unlinked" |
    And The document "tenant-ayse":"sensors":"DummyTemp_attached-ayse-unlinked" content match:
      | assetId | "PERFO-unlinked" |
    And The document "tenant-ayse":"assets":"PERFO-unlinked" content match:
      | measures.temperature.id          | "DummyTemp_attached-ayse-unlinked" |
      | measures.temperature.model       | "DummyTemp"                        |
      | measures.temperature.reference   | "attached-ayse-unlinked"           |
      | measures.temperature.updatedAt   | 1610793427950                      |
      | measures.temperature.payloadUuid | "_STRING_"                         |
      | measures.temperature.degree      | 23.3                               |
      | measures.temperature.qos.battery | 80                                 |

  Scenario: Error when linking sensor to an asset
    When I execute the action "device-manager/sensor":"linkAsset" with args:
      | _id     | "DummyTemp_detached" |
      | assetId | "PERFO-unlinked"     |
    Then I should receive an error matching:
      | message | "Sensor \"DummyTemp_detached\" is not attached to a tenant" |
    When I execute the action "device-manager/sensor":"linkAsset" with args:
      | _id     | "DummyTemp_attached-ayse-unlinked" |
      | assetId | "PERFO-non-existing"               |
    Then I should receive an error matching:
      | message | "Asset \"PERFO-non-existing\" does not exists" |

  Scenario: Unlink sensor from an asset
    Given I successfully execute the action "device-manager/sensor":"linkAsset" with args:
      | _id     | "DummyTemp_attached-ayse-unlinked" |
      | assetId | "PERFO-unlinked"                   |
    When I successfully execute the action "device-manager/sensor":"unlink" with args:
      | _id | "DummyTemp_attached-ayse-unlinked" |
    Then The document "device-manager":"sensors":"DummyTemp_attached-ayse-unlinked" content match:
      | assetId | null |
    And The document "tenant-ayse":"assets":"PERFO-unlinked" content match:
      | measures | null |

  Scenario: Error when unlinking from an asset
    When I execute the action "device-manager/sensor":"unlink" with args:
      | _id | "DummyTemp_attached-ayse-unlinked" |
    Then I should receive an error matching:
      | message | "Sensor \"DummyTemp_attached-ayse-unlinked\" is not linked to an asset" |
