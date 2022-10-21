Feature: Device provisioning

  Scenario: Create a device in administration index
    When I successfully execute the action "device-manager/device":"create" with args:
      | engineId       | "device-manager" |
      | body.model     | "DummyTemp"      |
      | body.reference | "MATALE"         |
    Then The document "device-manager":"devices":"DummyTemp-MATALE" exists

  Scenario: Create a device in an engine and linked to an asset
    When I successfully execute the action "device-manager/device":"create" with args:
      | engineId               | "engine-ayse"                                                           |
      | body.assetId           | "container-FRIDGE-unlinked_1"                                           |
      | body.measureNamesLinks | [{"assetMeasureName":"coreTemp", "deviceMeasureName":"theTemperature"}] |
      | body.model             | "DummyTemp"                                                             |
      | body.reference         | "MATALE"                                                                |
    Then The document "device-manager":"devices":"DummyTemp-MATALE" content match:
      | assetId | "container-FRIDGE-unlinked_1" |
    And The document "engine-ayse":"devices":"DummyTemp-MATALE" content match:
      | assetId | "container-FRIDGE-unlinked_1" |
    And The document "engine-ayse":"assets":"container-FRIDGE-unlinked_1" content match:
      | deviceLinks[0].deviceId                               | "DummyTemp-MATALE" |
      | deviceLinks[0].measureNamesLinks[0].assetMeasureName  | "coreTemp"         |
      | deviceLinks[0].measureNamesLinks[0].deviceMeasureName | "theTemperature"   |

  Scenario: Create a device with an incorrect link request (wrong measureNamesLinks) throw an error:
    When I execute the action "device-manager/device":"create" with args:
      | engineId               | "engine-ayse"                                                           |
      | body.measureNamesLinks | [{"assetMeasureName":"coreTemp", "deviceMeasureName":"theTemperature"}] |
      | body.model             | "DummyTemp"                                                             |
      | body.reference         | "MATALE"                                                                |
    Then I should receive an error matching:
      | message | "A link request is given without any assetId\\nThis is probably not a Kuzzle error, but a problem with a plugin implementation." |

  Scenario: Create a device with an incorrect link request (no assetId) throw an error:
    When I execute the action "device-manager/device":"create" with args:
      | engineId               | "engine-ayse"                                                             |
      | body.assetId           | "container-FRIDGE-unlinked_1"                                             |
      | body.measureNamesLinks | [{"invalidMeasureName":"coreTemp", "deviceMeasureName":"theTemperature"}] |
      | body.model             | "DummyTemp"                                                               |
      | body.reference         | "MATALE"                                                                  |
    Then I should receive an error matching:
      | message | "The linkRequest provided is not valid\\nThis is probably not a Kuzzle error, but a problem with a plugin implementation." |