-- CreateTable
CREATE TABLE "employee_bank_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_holder" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "ifsc" TEXT NOT NULL,
    "branch_name" TEXT,
    "proof_file" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "rejection_reason" TEXT,
    "verified_by" TEXT,
    "verified_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "employee_bank_accounts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "employee_bank_accounts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "employee_bank_accounts_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
