import unittest
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import Session
from app.database import Base
from app.seed import migrate_database_schema


class UpgradeSchemaTests(unittest.TestCase):
    def test_existing_database_gets_booking_fields_and_can_migrate_twice(self):
        engine = create_engine('sqlite://')
        try:
            Base.metadata.create_all(engine)
            with engine.begin() as connection:
                connection.execute(text('DROP INDEX ix_booking_requests_entity'))
                connection.execute(text('ALTER TABLE booking_requests DROP COLUMN entity'))
                connection.execute(text('ALTER TABLE booking_requests DROP COLUMN is_ddp'))
            with Session(engine) as db:
                migrate_database_schema(db)
                migrate_database_schema(db)
            columns = {column['name'] for column in inspect(engine).get_columns('booking_requests')}
            self.assertTrue({'entity', 'is_ddp'} <= columns)
        finally:
            engine.dispose()
