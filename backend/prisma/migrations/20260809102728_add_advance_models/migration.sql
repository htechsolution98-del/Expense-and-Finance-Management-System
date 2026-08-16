-- CreateTable
CREATE TABLE "advances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "advance_no" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "purpose" TEXT NOT NULL,
    "date_needed" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "outstanding_amount" REAL NOT NULL DEFAULT 0.0,
    "disburse_account_id" TEXT,
    "disbursed_at" DATETIME,
    "created_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "advances_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "advances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "advances_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "advances_disburse_account_id_fkey" FOREIGN KEY ("disburse_account_id") REFERENCES "accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "advance_settlements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "advance_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "advance_settlements_advance_id_fkey" FOREIGN KEY ("advance_id") REFERENCES "advances" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "advance_settlements_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "transaction_no" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "account_id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "payment_mode" TEXT NOT NULL,
    "reference_no" TEXT,
    "transfer_group_id" TEXT,
    "reversal_of_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expense_id" TEXT,
    "payroll_item_id" TEXT,
    "advance_id" TEXT,
    "client_id" TEXT,
    "vendor_id" TEXT,
    "employee_id" TEXT,
    "loan_id" TEXT,
    CONSTRAINT "transactions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transactions_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transactions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transactions_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transactions_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "transactions" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transactions_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transactions_payroll_item_id_fkey" FOREIGN KEY ("payroll_item_id") REFERENCES "payroll_items" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transactions_advance_id_fkey" FOREIGN KEY ("advance_id") REFERENCES "advances" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_transactions" ("account_id", "amount", "category", "client_id", "company_id", "created_at", "created_by", "date", "employee_id", "expense_id", "id", "loan_id", "payment_mode", "payroll_item_id", "purpose", "reference_no", "reversal_of_id", "transaction_no", "transfer_group_id", "type", "vendor_id") SELECT "account_id", "amount", "category", "client_id", "company_id", "created_at", "created_by", "date", "employee_id", "expense_id", "id", "loan_id", "payment_mode", "payroll_item_id", "purpose", "reference_no", "reversal_of_id", "transaction_no", "transfer_group_id", "type", "vendor_id" FROM "transactions";
DROP TABLE "transactions";
ALTER TABLE "new_transactions" RENAME TO "transactions";
CREATE UNIQUE INDEX "transactions_transaction_no_key" ON "transactions"("transaction_no");
CREATE UNIQUE INDEX "transactions_reversal_of_id_key" ON "transactions"("reversal_of_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "advances_advance_no_key" ON "advances"("advance_no");
