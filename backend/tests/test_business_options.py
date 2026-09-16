import unittest
from fastapi import HTTPException
from pydantic import ValidationError
from app.business_options import validate_business_options
from app.schemas import B2BCompanyCreate

class BusinessOptionsTests(unittest.TestCase):
    def test_settings_round_trip_and_preserve_other_keys(self):
        result = validate_business_options({'companyName': ' Custom Logistics ', 'invoicePrefix': 'CUSTOM-',
            'gstRates': [5, 5, 12], 'defaultGstRate': 12, 'defaultB2BCreditDays': 45,
            'defaultB2BCreditLimit': 0, 'serviceTypes': [' Road Express ', 'Air Express'],
            'paymentMethods': ['Cash', 'Bank Transfer'], 'couriers': ['My Courier']})
        self.assertEqual(result['companyName'], 'Custom Logistics')
        self.assertEqual(result['gstRates'], [5,12])
        self.assertEqual(result['serviceTypes'], ['Road Express','Air Express'])
        self.assertEqual(result['couriers'], ['My Courier'])
        self.assertEqual(result['defaultB2BCreditLimit'], 0)

    def test_invalid_configuration_rejected(self):
        for payload in [{'invoicePrefix': '../oops'}, {'defaultGstRate': -1}, {'gstRates': [float('nan')]},
                        {'defaultB2BCreditDays': 1.5}, {'defaultB2BCreditLimit': -1},
                        {'paymentMethods': []}, {'paymentMethods': ['Unsupported']}, {'serviceTypes': ['']}]:
            with self.subTest(payload=payload), self.assertRaises(HTTPException):
                validate_business_options(payload)

    def test_custom_b2b_terms_and_zero_limit(self):
        company = B2BCompanyCreate(company_name='Example', contact_person='Contact', mobile='9000000001', credit_limit=0, credit_period_days=45)
        self.assertEqual(company.credit_limit, 0)
        self.assertEqual(company.credit_period_days, 45)
        with self.assertRaises(ValidationError):
            B2BCompanyCreate(company_name='Example', contact_person='Contact', mobile='9000000001', credit_period_days=0)
