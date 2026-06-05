# Separate Funding and Expenditure Ledgers

We will model funding received and expenditure made as separate write tables because they have different forms, required fields, validation rules, public identifiers, and PHC-specific behavior. Unified admin reporting will be built through database views rather than by forcing both concepts into one polymorphic financial-entry table.
