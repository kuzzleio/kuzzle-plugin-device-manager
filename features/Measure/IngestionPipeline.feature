Feature: Ingestion Pipeline Events

  # Test the "device-manager:measures:process:before" event
  Scenario: Enrich a measure for a device linked to an asset with asset info
    Given I successfully execute the action "device-manager/devices":"create" with args:
      | engineId       | "engine-ayse"      |
      | body.model     | "DummyTemp"        |
      | body.reference | "enrich_me_master" |
    Given I successfully execute the action "device-manager/devices":"linkAsset" with args:
      | _id                           | "DummyTemp-enrich_me_master" |
      | assetId                       | "container-unlinked1"        |
      | engineId                      | "engine-ayse"                |
      | body.measureNames.temperature | "temperatureExt"             |
    Given I send the following "dummy-temp" payloads:
      | deviceEUI          | temperature |
      | "enrich_me_master" | 21          |
    And I refresh the collection "engine-ayse":"measures"
    Then When I successfully execute the action "document":"search" with args:
      | index      | "engine-ayse"                                        |
      | collection | "measures"                                           |
      | body       | { query: { term:{"asset.id":"container-unlinked1"}}} |
    # temperature has been multiplied by 2
    And I should receive a result matching:
      | hits[0]._source.type               | "temperature" |
      | hits[0]._source.values.temperature | 42            |
    Then The document "device-manager":"devices":"DummyTemp-enrich_me_master" content match:
      | measures.temperature.values.temperature | 42 |
    Then The document "engine-ayse":"devices":"DummyTemp-enrich_me_master" content match:
      | measures.temperature.values.temperature | 42 |
    Then The document "engine-ayse":"assets":"container-unlinked1" content match:
      | measures.temperatureExt.values.temperature | 42 |