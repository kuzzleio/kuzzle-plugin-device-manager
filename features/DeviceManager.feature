Feature: Device Manager Plugin

  Scenario: Merge custom mappings
    When I successfully execute the action "collection":"getMapping" with args:
      | index      | "device-manager" |
      | collection | "sensors"        |
    Then I should receive a result matching:
      | properties.metadata.properties.battery.type                | "integer" |
      | properties.measures.properties.shock.properties.value.type | "float"   |