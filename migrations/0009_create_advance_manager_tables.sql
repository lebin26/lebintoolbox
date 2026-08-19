-- Migration 0009: Create Advance Manager (垫付管理) Tables
-- Supports Multi-tenant Person Management, Expenses, Split Participants, Settlements, and Audit Logs

-- 1. Persons Table (涉及人物，独立于系统登录账号)
CREATE TABLE IF NOT EXISTS am_persons (
    id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    nickname TEXT,
    phone TEXT,
    email TEXT,
    avatar_url TEXT,
    note TEXT,
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_am_persons_owner ON am_persons(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_am_persons_archived ON am_persons(owner_user_id, is_archived);

-- 2. Categories Table (支出分类)
CREATE TABLE IF NOT EXISTS am_categories (
    id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    icon TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_am_categories_owner ON am_categories(owner_user_id);

-- 3. Projects Table (活动/旅行/项目)
CREATE TABLE IF NOT EXISTS am_projects (
    id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    start_date TEXT,
    end_date TEXT,
    status TEXT NOT NULL DEFAULT 'active', -- active, completed, archived
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_am_projects_owner ON am_projects(owner_user_id);

-- 4. Expenses 主交易表 (以分 cents 保存整数金额)
CREATE TABLE IF NOT EXISTS am_expenses (
    id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL,
    transaction_date TEXT NOT NULL,
    description TEXT NOT NULL,
    total_amount INTEGER NOT NULL, -- 整数，如 1250 代表 RM 12.50
    currency TEXT NOT NULL DEFAULT 'MYR',
    payer_person_id TEXT NOT NULL, -- 指向 am_persons.id
    category_id TEXT,
    project_id TEXT,
    payment_method TEXT NOT NULL DEFAULT 'other', -- cash, card, bank_transfer, ewallet, other
    status TEXT NOT NULL DEFAULT 'unsettled', -- unsettled, partial, settled, cancelled
    note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_am_expenses_owner_date ON am_expenses(owner_user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_am_expenses_payer ON am_expenses(payer_person_id);
CREATE INDEX IF NOT EXISTS idx_am_expenses_project ON am_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_am_expenses_category ON am_expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_am_expenses_status ON am_expenses(owner_user_id, status);

-- 5. Expense Participants 参与者分摊明细表
CREATE TABLE IF NOT EXISTS am_expense_participants (
    id TEXT PRIMARY KEY,
    expense_id TEXT NOT NULL,
    person_id TEXT NOT NULL,
    split_type TEXT NOT NULL DEFAULT 'equal', -- equal, fixed, percentage
    share_amount INTEGER NOT NULL, -- 应承担金额 (cents)
    percentage REAL,               -- 百分比 (若 split_type = percentage)
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_am_participants_expense ON am_expense_participants(expense_id);
CREATE INDEX IF NOT EXISTS idx_am_participants_person ON am_expense_participants(person_id, expense_id);

-- 6. Settlements 还款/结算表
CREATE TABLE IF NOT EXISTS am_settlements (
    id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL,
    from_person_id TEXT NOT NULL, -- 还款人
    to_person_id TEXT NOT NULL,   -- 收款人
    amount INTEGER NOT NULL,      -- 还款金额 (cents)
    currency TEXT NOT NULL DEFAULT 'MYR',
    settlement_date TEXT NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
    note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_am_settlements_owner_date ON am_settlements(owner_user_id, settlement_date DESC);
CREATE INDEX IF NOT EXISTS idx_am_settlements_from ON am_settlements(from_person_id);
CREATE INDEX IF NOT EXISTS idx_am_settlements_to ON am_settlements(to_person_id);

-- 7. Audit Logs 审计追踪表
CREATE TABLE IF NOT EXISTS am_audit_logs (
    id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL,
    entity_type TEXT NOT NULL, -- expense, person, settlement, project, category
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,      -- create, update, delete, cancel, settle
    old_data TEXT,             -- JSON 字符串
    new_data TEXT,             -- JSON 字符串
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_am_audit_logs_owner ON am_audit_logs(owner_user_id, created_at DESC);
