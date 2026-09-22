"""Validated shipment weight policies; dimensions stored in cm, weight in kg."""
from decimal import Decimal, ROUND_HALF_UP, ROUND_CEILING
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict


class WeightRule(BaseModel):
    model_config = ConfigDict(extra='forbid')
    divisor: float = Field(default=5000, gt=0, le=1000000, allow_inf_nan=False)
    basis: Literal['higher', 'actual', 'volumetric'] = 'higher'
    aggregation: Literal['shipment', 'box'] = 'shipment'
    rounding: float = Field(default=0, ge=0, le=1000, allow_inf_nan=False)
    minimum: float = Field(default=0, ge=0, le=100000, allow_inf_nan=False)


class WeightOverride(WeightRule):
    courier: str = Field(default='', max_length=100)
    service: str = Field(default='', max_length=100)
    destination: Literal['Any', 'Domestic', 'International'] = 'Any'


class WeightSettings(BaseModel):
    model_config = ConfigDict(extra='forbid')
    express: WeightRule = Field(default_factory=WeightRule)
    cargo: WeightRule = Field(default_factory=lambda: WeightRule(divisor=4000))
    overrides: list[WeightOverride] = Field(default_factory=list, max_length=100)


def resolve_weight_rule(settings, courier='', service='', destination='International'):
    policy = WeightSettings.model_validate((settings or {}).get('weightRules') or {})
    matched = []
    for index, rule in enumerate(policy.overrides):
        if rule.courier.strip() and rule.courier.strip().lower() != courier.strip().lower():
            continue
        if rule.service.strip() and rule.service.strip().lower() != service.strip().lower():
            continue
        if rule.destination != 'Any' and rule.destination != destination:
            continue
        score = bool(rule.courier.strip()) + bool(rule.service.strip()) + (rule.destination != 'Any')
        matched.append((score, -index, rule))
    chosen = max(matched, key=lambda item: item[:2])[2] if matched else (
        policy.cargo if 'cargo' in f'{courier} {service}'.lower() else policy.express)
    return WeightRule.model_validate({key: getattr(chosen, key) for key in WeightRule.model_fields})


def calculate_weights(parcels, rule):
    """Apply minimum/round-up per shipment or per box, then round totals to 2dp."""
    dec = lambda value: Decimal(str(value or 0))
    rounded = lambda value: float(value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))
    pairs = [(dec(p.actual_weight), dec(p.length) * dec(p.width) * dec(p.height) / dec(rule.divisor)) for p in parcels]
    actual = sum((a for a, _ in pairs), Decimal(0))
    volume = sum((v for _, v in pairs), Decimal(0))

    def bill(a, v):
        weight = a if rule.basis == 'actual' else v if rule.basis == 'volumetric' else max(a, v)
        weight = max(weight, dec(rule.minimum))
        if rule.rounding:
            step = dec(rule.rounding)
            weight = (weight / step).to_integral_value(rounding=ROUND_CEILING) * step
        return weight

    charge = sum((bill(a, v) for a, v in pairs), Decimal(0)) if rule.aggregation == 'box' else bill(actual, volume)
    return rounded(actual), rounded(volume), rounded(charge)
