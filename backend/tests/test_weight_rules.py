import unittest
from types import SimpleNamespace
from pydantic import ValidationError
from app.weight_rules import WeightRule, WeightSettings, resolve_weight_rule, calculate_weights
from app.schemas import ParcelInfo


class WeightRulesTests(unittest.TestCase):
    def test_defaults_and_override_priority(self):
        self.assertEqual(resolve_weight_rule({}, service='Cargo').divisor, 4000)
        self.assertEqual(resolve_weight_rule({}).divisor, 5000)
        settings = {'weightRules': {'overrides': [
            {'courier': 'FedEx', 'divisor': 6000},
            {'courier': 'fedex', 'service': 'Economy', 'destination': 'Domestic', 'divisor': 3000},
        ]}}
        self.assertEqual(resolve_weight_rule(settings, 'FEDEX', 'Economy', 'Domestic').divisor, 3000)
        self.assertEqual(resolve_weight_rule(settings, 'FEDEX', 'Economy').divisor, 6000)
        self.assertEqual(resolve_weight_rule(settings, 'Other', 'Economy').divisor, 5000)

    def test_box_aggregation_minimum_and_rounding(self):
        parcels = [SimpleNamespace(length=40, width=30, height=20, actual_weight=3),
                   SimpleNamespace(length=10, width=10, height=10, actual_weight=5.1)]
        self.assertEqual(calculate_weights(parcels, WeightRule()), (8.1, 5.0, 8.1))
        self.assertEqual(calculate_weights(parcels, WeightRule(aggregation='box', rounding=.5)), (8.1, 5.0, 10.5))
        self.assertEqual(calculate_weights(parcels, WeightRule(basis='volumetric', minimum=6, rounding=1)), (8.1, 5.0, 6))
        self.assertEqual(calculate_weights(parcels, WeightRule(basis='actual', rounding=1)), (8.1, 5.0, 9))

    def test_rounding_boundary_and_invalid_inputs(self):
        box = SimpleNamespace(length=10, width=10, height=10, actual_weight=1.00001)
        self.assertEqual(calculate_weights([box], WeightRule(rounding=.5))[2], 1.5)
        box.actual_weight = 1
        self.assertEqual(calculate_weights([box], WeightRule(rounding=.5))[2], 1)
        for bad in [0, -1, float('nan'), float('inf')]:
            with self.assertRaises(ValidationError):
                WeightSettings.model_validate({'express': {'divisor': bad}})
        with self.assertRaises(ValidationError):
            ParcelInfo(length=-1)
