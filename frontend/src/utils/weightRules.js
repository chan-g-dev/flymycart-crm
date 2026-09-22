export const defaultWeightRule = { divisor: 5000, basis: 'higher', aggregation: 'shipment', rounding: 0, minimum: 0 };
export const weightSettings = settings => ({
    express: { ...defaultWeightRule, ...settings?.weightRules?.express },
    cargo: { ...defaultWeightRule, divisor: 4000, ...settings?.weightRules?.cargo },
    overrides: settings?.weightRules?.overrides || [],
});

export function resolveWeightRule(settings, courier = '', service = '', destination = 'International') {
    const policy = weightSettings(settings);
    const norm = value => (value || '').trim().toLowerCase();
    const matches = policy.overrides.filter(rule =>
        (!norm(rule.courier) || norm(rule.courier) === norm(courier)) &&
        (!norm(rule.service) || norm(rule.service) === norm(service)) &&
        (rule.destination === 'Any' || rule.destination === destination));
    const score = rule => Number(Boolean(norm(rule.courier))) + Number(Boolean(norm(rule.service))) + Number(rule.destination !== 'Any');
    matches.sort((a, b) => score(b) - score(a));
    return matches[0] || (/cargo/i.test(`${courier} ${service}`) ? policy.cargo : policy.express);
}

export function calculateWeights(parcels, rule) {
    const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
    const pairs = parcels.map(p => [Number(p.actual_weight) || 0, (Number(p.length) || 0) * (Number(p.width) || 0) * (Number(p.height) || 0) / rule.divisor]);
    const actual = pairs.reduce((sum, [a]) => sum + a, 0);
    const volume = pairs.reduce((sum, [, v]) => sum + v, 0);
    const bill = (a, v) => {
        let value = Math.max(rule.minimum, rule.basis === 'actual' ? a : rule.basis === 'volumetric' ? v : Math.max(a, v));
        if (rule.rounding > 0) value = Math.ceil(value / rule.rounding - 1e-10) * rule.rounding;
        return value;
    };
    const charge = rule.aggregation === 'box' ? pairs.reduce((sum, [a, v]) => sum + bill(a, v), 0) : bill(actual, volume);
    return { actual_weight: round(actual), volumetric_weight: round(volume), chargeable_weight: round(charge) };
}

export function parcelsInCm(form) {
    const factor = form.dimension_unit === 'in' ? 2.54 : 1;
    return (form.boxes.length ? form.boxes : [form]).map(p => ({
        actual_weight: Number(p.actual_weight) || 0,
        ...Object.fromEntries(['length', 'width', 'height'].map(key => [key, Number(((Number(p[key]) || 0) * factor).toFixed(6))])),
    }));
}
