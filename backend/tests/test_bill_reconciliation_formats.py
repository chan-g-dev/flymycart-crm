import unittest
from app.bill_import import parse_bill_file, parse_table, columns, normalized

class BillReconciliationFormatsTest(unittest.TestCase):
    def test_delhivery_csv_format(self):
        csv_text = """waybill_num,client,pickup_date,serial_number,origin_center,client_gstin,delhivery_gstin,package_type,product_value,cod_amount,status,charged_weight,zone,payment_mode,payment_mode_type,issuing_bank,charge_POD,charge_COVID,charge_FSC,charge_DL,charge_RTO,charge_DTO,charge_COD,charge_FS,charge_FOV,charge_CCOD,charge_WOD,charge_AIR,charge_pickup,charge_DPH,charge_QC,charge_CWH,charge_E2E,charge_LM,charge_DEMUR,charge_LABEL,charge_REATTEMPT,charge_DOCUMENT,charge_ROV,charge_PEAK,IGST,CGST,SGST/UGST,gross_amount,total_amount,destination_pin,order_id,item_shipped,fpd,atc,mcount,pdd,frd,qc_pass,qc_atc,fuel_base_rate,avg_fuel_rate,fuel_hike,packaging_type,qc,qct,qty,sot
31301410007033,JUSTDELL FRANCHISE,2026-08-08 13:12:54,EPH26256681,Bangalore_BenniganaHalli_C (Karnataka),29AAFCJ4230K1ZF,29AAPCS9575E1ZJ,Pre-paid,5000,0,Delivered,800,B,,,,0,0,0,63,0,0,0,0,0,0,0,0,0,2.33,0,0,0,0,0,0,0,0,0,2,0,6.06,6.06,67.33,79.45,638459,456123,MEDICINE(1),2026-08-11 06:45:48,1,0,2026-08-11 18:29:59,,FALSE,0,85.5,98.15,12.65,box,FALSE,,1,D
31301410006845,JUSTDELL FRANCHISE,2026-08-03 14:01:42,EPH26256681,Bangalore_BenniganaHalli_C (Karnataka),29AAFCJ4230K1ZF,29AAPCS9575E1ZJ,Pre-paid,5000,0,Delivered,100,B,,,,0,0,0,36,0,0,0,0,0,0,0,0,0,1.33,0,0,0,0,0,0,0,0,0,2,0,3.54,3.54,39.33,46.41,575004,575004,Documents(1),2026-08-07 03:03:32,1,0,2026-08-07 18:29:59,,FALSE,0,85.5,98.15,12.65,,FALSE,,1,D
"""
        entries, info = parse_bill_file(csv_text.encode('utf-8'), 'delhivery.csv', lambda t: [])
        self.assertEqual(len(entries), 2)
        self.assertEqual(entries[0]['awb'], '31301410007033')
        self.assertEqual(entries[0]['actual_cost'], 79.45)
        self.assertEqual(entries[1]['awb'], '31301410006845')
        self.assertEqual(entries[1]['actual_cost'], 46.41)

    def test_partner_fedex_csv_with_reference_no(self):
        csv_text = """Date,Airway Bill No.,HQ Client,Status,Reference No.,Partner,Registered Name,LOB,Client Type,No. of box,Billed Weight,Destination,OC,Zone,Shipment Type,Service Booked,Freight,FSC,Additional emergency surcharge,Freight Discount,Gross Revenue
27-07-2026 16:46,DL345216795XB,53d0d5-GlobeCourier-in,Delivered,874902458328,fedex,,INT,prepaid,1,0.5,NL,Bangalore_XB_INT (Karnataka),South,Non Docs,EXPORTS_EXPRESS,1131,505.12,17,0,1653.12
18-07-2026 14:44,DL345053975XB,53d0d5-GlobeCourier-in,Delivered,874562203191,fedex,,INT,prepaid,1,5,US,Bangalore_XB_INT (Karnataka),South,Non Docs,EXPORTS_EXPRESS,3375,1351.35,135,0,4861.35
,,,,,,,,,,,,,,,,4506,1856.47,152,,6514.47
"""
        entries, info = parse_bill_file(csv_text.encode('utf-8'), 'fedex_globe.csv', lambda t: [])
        self.assertEqual(len(entries), 2)
        self.assertEqual(entries[0]['awb'], 'DL345216795XB')
        self.assertEqual(entries[0]['actual_cost'], 1653.12)
        self.assertEqual(entries[1]['awb'], 'DL345053975XB')
        self.assertEqual(entries[1]['actual_cost'], 4861.35)

    def test_courier_table_with_forwarding_no(self):
        table_rows = [
            ["Sr.No.", "Date", "A.W.B.No.", "D/N", "Destination", "Forwarding No", "Weight", "Freight", "FSC", "CLR Chrg", "Other Chrg", "Total Amt."],
            ["1", "10/08/26", "10098609", "N", "AUSTRALIA", "9678333022", "1.000", "1700.60", "822.24", "0.00", "0.00", "2522.84"],
            ["2", "13/08/26", "10099006", "N", "MALDIVES", "1478122623", "0.500", "1213.30", "586.63", "250.00", "0.00", "2049.93"],
            ["3", "14/08/26", "1043378954", "N", "U.S.A.", "", "48.000", "24657.60", "11921.95", "3000.00", "0.00", "39579.55"],
            ["4", "14/08/26", "1043378954OS", "D", "U.S.A.", "", "0.500", "1900.00", "918.65", "0.00", "0.00", "2818.65"],
        ]
        entries, mappings, warnings = parse_table(table_rows, "table_test")
        self.assertEqual(len(entries), 4)
        self.assertEqual(entries[0]['awb'], '10098609')
        self.assertEqual(entries[0]['actual_cost'], 2522.84)
        self.assertEqual(entries[3]['awb'], '1043378954OS')
        self.assertEqual(entries[3]['actual_cost'], 2818.65)

    def test_courier_table_with_amount_and_total(self):
        table_rows = [
            ["Sr.", "AWB No.", "Date", "Destination", "Network", "D/S", "Weight", "Amount", "PSS", "FSC", "Total"],
            ["1", "6003516401", "21/08/2026", "GERMANY", "FDX", "SPX", "0.500", "1064.00", "15.00", "501.74", "1580.74"],
            ["2", "6003525090", "24/08/2026", "U.S.A.", "FDX", "SPX", "1.500", "1345.00", "30.00", "639.38", "2014.38"],
            ["OTHERS WS", "", "", "", "", "", "", "40.00", "", "", "40.00"]
        ]
        entries, mappings, warnings = parse_table(table_rows, "sample5_test")
        self.assertEqual(len(entries), 2)
        self.assertEqual(entries[0]['awb'], '6003516401')
        self.assertEqual(entries[0]['actual_cost'], 1580.74)
        self.assertEqual(entries[1]['awb'], '6003525090')
        self.assertEqual(entries[1]['actual_cost'], 2014.38)

if __name__ == '__main__':
    unittest.main()
