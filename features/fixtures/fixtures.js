// --- Payloads -------------------------------------------

const payload_0 = {
  uuid: '0',
  valid: true,
  deviceModel: 'DummyMultiTemp',
  payload: {
    payloads: [
      {
        deviceEUI: 'attached_ayse_unlinked',
        register1: 30.1,
        register2: 30.3,
        lvlBattery: 13
      },
      {
        deviceEUI: 'attached_ayse_linked-1',
        register1: -3.1,
        register2: 29.2,
        lvlBattery: 80
      }
    ]
  }
};

const payload_1 = {
  uuid: '1',
  valid: false,
  deviceModel: 'DummyMultiTemp',
  payload: {
    invalid: true,
    payloads: [
      {
        deviceEUI: 'attached_ayse_unlinked',
        register2: 30.3,
      },
      {
        deviceEUI: 'attached_ayse_linked-1',
        register1: -3.1,
      }
    ]
  }
};

const payload_2 = {
  uuid: '2',
  valid: true,
  deviceModel: 'DummyMultiTemp',
  payload: {
    payloads: [
      {
        deviceEUI: 'attached_ayse_linked-2',
        register1: -2.3,
        register2: 30.1,
        lvlBattery: 78
      }
    ]
  }
};


// --- Measures -------------------------------------------

const measure_last_leftInnerTemp = {
  type: 'temperature',
  assetMeasureName: 'leftInnerTemp',
  deviceMeasureName: 'innerTemp',
  unit: {
    name: 'Degree',
    sign: '°',
    type: 'number',
  },
  values: {
    temperature: -3.1,
  },
  measuredAt: 1610793427900,
  origin: {
    id: 'DummyMultiTemp-attached_ayse_linked_1',
    type: 'device',
    deviceModel: 'DummyMultiTemp',
    payloadUuid: '0',
  }
};

const measure_last_leftExternalTemp = {
  type: 'temperature',
  assetMeasureName: 'leftExternalTemp',
  deviceMeasureName: 'extTemp',
  unit: {
    name: 'Degree',
    sign: '°',
    type: 'number',
  },
  values: {
    temperature: 29.2,
  },
  measuredAt: 1610793427900,
  origin: {
    id: 'DummyMultiTemp-attached_ayse_linked_1',
    type: 'device',
    deviceModel: 'DummyMultiTemp',
    payloadUuid: '0',
  }
};

const measure_last_rightInnerTemp = {
  type: 'temperature',
  assetMeasureName: 'rightInnerTemp',
  deviceMeasureName: 'innerTemp',
  unit: {
    name: 'Degree',
    sign: '°',
    type: 'number',
  },
  values: {
    temperature: -2.3,
  },
  measuredAt: 1610793427999,
  origin: {
    id: 'DummyMultiTemp-attached_ayse_linked_2',
    type: 'device',
    deviceModel: 'DummyMultiTemp',
    payloadUuid: '2',
  }
};

const measure_last_rightExternalTemp = {
  type: 'temperature',
  assetMeasureName: 'rightExternalTemp',
  deviceMeasureName: 'extTemp',
  unit: {
    name: 'Degree',
    sign: '°',
    type: 'number',
  },
  values: {
    temperature: 30.1,
  },
  measuredAt: 1610793427999,
  origin: {
    id: 'DummyMultiTemp-attached_ayse_linked_2',
    type: 'device',
    deviceModel: 'DummyMultiTemp',
    payloadUuid: '2',
  }
};

const measure_last_coreBatteryLevel = {
  type: 'battery',
  assetMeasureName: 'coreBatteryLevel',
  deviceMeasureName: 'lvlBattery',
  unit: {
    name: 'Volt',
    sign: 'v',
    type: 'number',
  },
  values: {
    battery: 78,
  },
  measuredAt: 1610793427999,
  origin: {
    id: 'DummyMultiTemp-attached_ayse_linked_2',
    type: 'device',
    deviceModel: 'DummyMultiTemp',
    payloadUuid: '2',
  }
};

const measure_old_coreBatteryLevel = {
  type: 'battery',
  assetMeasureName: 'coreBatteryLevel',
  deviceMeasureName: 'lvlBattery',
  unit: {
    name: 'Volt',
    sign: 'v',
    type: 'number',
  },
  values: {
    battery: 80,
  },
  measuredAt: 1610793427900,
  origin: {
    id: 'DummyMultiTemp-attached_ayse_linked_1',
    type: 'device',
    deviceModel: 'DummyMultiTemp',
    payloadUuid: '0',
  }
};

const measure_unlinked_innerTemp = {
  type: 'temperature',
  assetMeasureName: null,
  deviceMeasureName: 'innerTemp',
  unit: {
    name: 'Degree',
    sign: '°',
    type: 'number',
  },
  values: {
    temperature: 30.1,
  },
  measuredAt: 1610793427900,
  origin: {
    id: 'DummyMultiTemp-attached_ayse_unlinked',
    type: 'device',
    deviceModel: 'DummyMultiTemp',
    payloadUuid: '0',
  }
};

const measure_unlinked_extTemp = {
  type: 'temperature',
  assetMeasureName: null,
  deviceMeasureName: 'extTemp',
  unit: {
    name: 'Degree',
    sign: '°',
    type: 'number',
  },
  values: {
    temperature: 30.3,
  },
  measuredAt: 1610793427900,
  origin: {
    id: 'DummyMultiTemp-attached_ayse_unlinked',
    type: 'device',
    deviceModel: 'DummyMultiTemp',
    payloadUuid: '0',
  }
};

const measure_unlinked_lvlBattery = {
  type: 'battery',
  assetMeasureName: 'coreBatteryLevel',
  deviceMeasureName: 'lvlBattery',
  unit: {
    name: 'Volt',
    sign: 'v',
    type: 'number',
  },
  values: {
    battery: 13,
  },
  measuredAt: 1610793427900,
  origin: {
    id: 'DummyMultiTemp-attached_ayse_unlinked',
    type: 'device',
    deviceModel: 'DummyMultiTemp',
    payloadUuid: '0',
  }
};


// --- Devices --------------------------------------------

const device_DummyMultiTemp_AttachedAyse_linked_1 = {
  reference: 'attached_ayse_linked_1',
  model: 'DummyMultiTemp',
  measures: [
    measure_last_leftInnerTemp,
    measure_last_leftExternalTemp,
    measure_old_coreBatteryLevel,
  ],
  engineId: 'engine-ayse',
  assetId: 'container-FRIDGE-linked',
};

const device_DummyMultiTemp_AttachedAyse_linked_2 = {
  reference: 'attached_ayse_linked_2',
  model: 'DummyMultiTemp',
  measures: [
    measure_last_rightInnerTemp,
    measure_last_rightExternalTemp,
    measure_last_coreBatteryLevel
  ],
  engineId: 'engine-ayse',
  assetId: 'container-FRIDGE-linked'
};

const device_DummyMultiTemp_AttachedAyse_unlinked = {
  reference: 'attached_ayse_unlinked',
  model: 'DummyMultiTemp',
  engineId: 'engine-ayse',
  measures: [
    measure_unlinked_innerTemp,
    measure_unlinked_extTemp,
    measure_unlinked_lvlBattery
  ],
  assetId: null
};

const device_DummyMultiTemp_detached = {
  reference: 'detached',
  model: 'DummyMultiTemp',
  measures: [],
  assetId: null
};


// --- Assets ---------------------------------------------

const asset_Fridge_AttachedAyse_linked = {
  type: 'container',
  model: 'FRIDGE',
  reference: 'linked',
  measures: [
    measure_last_coreBatteryLevel,
    measure_last_leftExternalTemp,
    measure_last_leftInnerTemp,
    measure_last_rightExternalTemp,
    measure_last_rightInnerTemp
  ],
  deviceLinks: [
    {
      deviceId: 'DummyMultiTemp-attached_ayse_linked_1',
      measureNamesLinks: [
        {
          assetMeasureName: 'leftInnerTemp',
          deviceMeasureName: 'innerTemp',

        },
        {
          assetMeasureName: 'leftExternalTemp',
          deviceMeasureName: 'extTemp',

        },
        {
          assetMeasureName: 'coreBatteryLevel',
          deviceMeasureName: 'lvlBattery',
        }
      ]
    },
    {
      deviceId: 'DummyMultiTemp-attached_ayse_linked_2',
      measureNamesLinks: [
        {
          assetMeasureName: 'rightInnerTemp',
          deviceMeasureName: 'innerTemp',

        },
        {
          assetMeasureName: 'rightExternalTemp',
          deviceMeasureName: 'extTemp',

        },
        {
          assetMeasureName: 'coreBatteryLevel',
          deviceMeasureName: 'lvlBattery',
        }
      ]
    }
  ],
}


// --- Exports --------------------------------------------

const devices = [
  { index: { _id: 'DummyMultiTemp-attached_ayse_linked_1' } },
  device_DummyMultiTemp_AttachedAyse_linked_1,
  { index: { _id: 'DummyMultiTemp-attached_ayse_linked_2' } },
  device_DummyMultiTemp_AttachedAyse_linked_2,
  { index: { _id: 'DummyMultiTemp-attached_ayse_unlinked' } },
  device_DummyMultiTemp_AttachedAyse_unlinked,
  { index: { _id: 'DummyMultiTemp-detached' } },
  device_DummyMultiTemp_detached,
]

module.exports = {
  'device-manager': {
    devices: devices,
    payloads: [
      { index: { _id: '0' } },
      payload_0,
      { index: { _id: '1' } },
      payload_1,
      { index: { _id: '2' } },
      payload_2,
    ]
  },
  'engine-ayse': {
    assets: [
      { index: { _id: 'container-FRIDGE-linked' } },
      asset_Fridge_AttachedAyse_linked,
    ],
    devices: devices,
    measures: [
      { index: { _id: '0' } },
      measure_last_leftInnerTemp,
      { index: { _id: '1' } },
      measure_last_leftExternalTemp,
      { index: { _id: '2' } },
      measure_last_rightInnerTemp,
      { index: { _id: '3' } },
      measure_last_rightExternalTemp,
      { index: { _id: '4' } },
      measure_last_coreBatteryLevel,
      { index: { _id: '5' } },
      measure_old_coreBatteryLevel,
      { index: { _id: '6' } },
      measure_unlinked_innerTemp,
      { index: { _id: '7' } },
      measure_unlinked_extTemp,
      { index: { _id: '8' } },
      measure_unlinked_lvlBattery,

    ]
  },
};
