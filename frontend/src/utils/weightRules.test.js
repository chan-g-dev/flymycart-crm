import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateWeights, resolveWeightRule, parcelsInCm, defaultWeightRule } from './weightRules.js';

test('default rules and most specific override match backend policy', () => {
    assert.equal(resolveWeightRule({}, '', 'Cargo').divisor, 4000);
    const settings = { weightRules: { overrides: [
        { ...defaultWeightRule, courier: 'FedEx', service: '', destination: 'Any', divisor: 6000 },
        { ...defaultWeightRule, courier: 'fedex', service: 'Economy', destination: 'Domestic', divisor: 3000 },
    ] } };
    assert.equal(resolveWeightRule(settings, 'FEDEX', 'Economy', 'Domestic').divisor, 3000);
    assert.equal(resolveWeightRule(settings, 'FedEx', 'Economy').divisor, 6000);
});

test('shipment and box billing, rounding and minimum match backend examples', () => {
    const boxes = [{ length: 40, width: 30, height: 20, actual_weight: 3 }, { length: 10, width: 10, height: 10, actual_weight: 5.1 }];
    assert.deepEqual(calculateWeights(boxes, defaultWeightRule), { actual_weight: 8.1, volumetric_weight: 5, chargeable_weight: 8.1 });
    assert.equal(calculateWeights(boxes, { ...defaultWeightRule, aggregation: 'box', rounding: .5 }).chargeable_weight, 10.5);
    assert.equal(calculateWeights(boxes, { ...defaultWeightRule, basis: 'volumetric', minimum: 6, rounding: 1 }).chargeable_weight, 6);
    assert.equal(calculateWeights(boxes, { ...defaultWeightRule, basis: 'actual', rounding: 1 }).chargeable_weight, 9);
});

test('inch inputs convert to canonical cm for single and multiple boxes', () => {
    const box = { length: 10, width: 10, height: 10, actual_weight: 1 };
    const expected = [{ length: 25.4, width: 25.4, height: 25.4, actual_weight: 1 }];
    assert.deepEqual(parcelsInCm({ ...box, dimension_unit: 'in', boxes: [] }), expected);
    assert.deepEqual(parcelsInCm({ dimension_unit: 'in', boxes: [box] }), expected);
});
