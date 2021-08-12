Feature: Device Provisionning

  @provisionning
  Scenario: Provision device in the catalog
    Given a collection "administration":"config"
    And I "update" the document "device-manager" with content:
      | device-manager.autoProvisionning | false |
    And I "create" the document "provisionning-1" with content:
      | type               | "catalog"         |
      | catalog.deviceId   | "DummyTemp-12345" |
      | catalog.authorized | true              |
    And I "create" the document "provisionning-2" with content:
      | type               | "catalog"          |
      | catalog.deviceId   | "DummyTemp-424242" |
      | catalog.authorized | false              |
    And I refresh the collection "administration":"config"
    # Provisionned device
    When I successfully receive a "dummy-temp" payload with:
      | deviceEUI    | "12345" |
      | register55   | 23.3    |
      | batteryLevel | 0.8     |
    Then The document "administration":"devices":"DummyTemp-12345" exists
    # Provisionned device but not authorized
    When I receive a "dummy-temp" payload with:
      | deviceEUI    | "424242" |
      | register55   | 23.3     |
      | batteryLevel | 0.8      |
    Then I should receive an error matching:
      | message | "Device DummyTemp-424242 is not allowed for registration." |
    And The document "administration":"devices":"DummyTemp-424242" does not exists
    # Unprovisionned device
    When I receive a "dummy-temp" payload with:
      | deviceEUI    | "212121" |
      | register55   | 23.3     |
      | batteryLevel | 0.8      |
    Then I should receive an error matching:
      | message | "Device DummyTemp-212121 is not provisionned." |
    And The document "administration":"devices":"DummyTemp-212121" does not exists

  Scenario: Admin catalog: Assign to tenant and asset
    Given a collection "administration":"config"
    And I "create" the document "provisionning-1" with content:
      | type             | "catalog"         |
      | catalog.deviceId | "DummyTemp-12345" |
      | catalog.tenantId | "tenant-ayse"     |
      | catalog.assetId  | "PERFO-unlinked"  |
    And I refresh the collection "administration":"config"
    When I successfully receive a "dummy-temp" payload with:
      | deviceEUI    | "12345" |
      | register55   | 23.3    |
      | batteryLevel | 0.8     |
    Then The document "tenant-ayse":"devices":"DummyTemp-12345" exists
    And The document "tenant-ayse":"devices":"DummyTemp-12345" content match:
      | assetId | "PERFO-unlinked" |

  Scenario: Tenant catalog: Assign to asset
    Given a collection "administration":"config"
    And I "create" the document "provisionning-1" with content:
      | type             | "catalog"         |
      | catalog.deviceId | "DummyTemp-12345" |
      | catalog.tenantId | "tenant-ayse"     |
    Given a collection "tenant-ayse":"config"
    And I "create" the document "provisionning-1" with content:
      | type             | "catalog"         |
      | catalog.deviceId | "DummyTemp-12345" |
      | catalog.assetId  | "PERFO-unlinked"  |
    And I refresh the collection "administration":"config"
    And I refresh the collection "tenant-ayse":"config"
    When I successfully receive a "dummy-temp" payload with:
      | deviceEUI    | "12345" |
      | register55   | 23.3    |
      | batteryLevel | 0.8     |
    Then The document "tenant-ayse":"devices":"DummyTemp-12345" content match:
      | assetId | "PERFO-unlinked" |
