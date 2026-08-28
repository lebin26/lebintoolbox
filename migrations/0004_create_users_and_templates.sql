-- Migration 0004: Users, Admin Logs, Data Isolation & Platform Templates

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'active',
  nickname TEXT,
  avatar_url TEXT,
  allowed_apps TEXT DEFAULT '["courtledger","financial"]',
  app_permissions TEXT DEFAULT '["courtledger:create_bill","courtledger:delete_bill","financial:manage"]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Admin Logs Table
CREATE TABLE IF NOT EXISTS admin_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  target_user_id INTEGER,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id)
);

-- 3. Add user_id column to existing business tables (Safe backward compatible)
ALTER TABLE bills ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE financial_platforms ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE financial_products ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE financial_periods ADD COLUMN user_id INTEGER REFERENCES users(id);

-- 4. Create Platform & Product Templates Table (Public / Preset Library)
CREATE TABLE IF NOT EXISTS financial_platform_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Banking',
  logo_url TEXT,
  description TEXT,
  default_currency TEXT NOT NULL DEFAULT 'MYR',
  preset_products_json TEXT NOT NULL DEFAULT '[]',
  is_official INTEGER NOT NULL DEFAULT 1,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_platform_templates_category ON financial_platform_templates(category);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_bills_user_id ON bills(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_platforms_user_id ON financial_platforms(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_products_user_id ON financial_products(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_periods_user_id ON financial_periods(user_id);

-- 5. Seed Initial System Official Templates
INSERT INTO financial_platform_templates (name, category, logo_url, description, default_currency, preset_products_json, is_official, usage_count)
VALUES 
(
  'Maybank 马来亚银行',
  'Banking',
  'https://images.seeklogo.com/logo-png/33/1/maybank-logo-png_seeklogo-330689.png',
  '马来西亚最大商业银行，支持储蓄卡、定期存款及外币活期账户',
  'MYR',
  '[{"name":"Maybank 储蓄账户 (Savings)","productType":"Savings","currency":"MYR"},{"name":"Maybank 定期存款 (FD)","productType":"FixedDeposit","currency":"MYR"}]',
  1,
  128
),
(
  'CIMB 联昌银行',
  'Banking',
  'https://images.seeklogo.com/logo-png/39/1/cimb-bank-logo-png_seeklogo-394931.png',
  '马来西亚主流零售银行，支持储蓄理财及转账',
  'MYR',
  '[{"name":"CIMB 储蓄账户","productType":"Savings","currency":"MYR"},{"name":"CIMB 定期存款 (FD)","productType":"FixedDeposit","currency":"MYR"}]',
  1,
  95
),
(
  'Public Bank 大众银行',
  'Banking',
  'https://images.seeklogo.com/logo-png/43/1/public-bank-logo-png_seeklogo-434033.png',
  '马来西亚稳健零售银行，适合定存及长期储蓄',
  'MYR',
  '[{"name":"Public Bank 储蓄账户","productType":"Savings","currency":"MYR"}]',
  1,
  72
),
(
  'GXBank (数字银行)',
  'Banking',
  'https://assets.grab.com/wp-content/uploads/sites/4/2023/11/30113524/GXBank-App-Icon-1024x1024.png',
  '马来西亚首批合规数字银行，每日派息活期储蓄口袋',
  'MYR',
  '[{"name":"GX 活期储蓄口袋 (Main Account)","productType":"Savings","currency":"MYR"},{"name":"GX 储蓄罐 (Saving Pockets)","productType":"Savings","currency":"MYR"}]',
  1,
  160
),
(
  'Touch ''n Go eWallet',
  'E-Wallet',
  'https://images.seeklogo.com/logo-png/41/1/touch-n-go-ewallet-logo-png_seeklogo-416625.png',
  '马来西亚国民电子钱包，内嵌 GO+ 货币基金与日常消费余额',
  'MYR',
  '[{"name":"TNG 钱包余额 (Wallet Balance)","productType":"Cash","currency":"MYR"},{"name":"TNG GO+ (货币基金理财)","productType":"Investment","currency":"MYR"}]',
  1,
  210
),
(
  'EPF / KWSP (雇员公积金)',
  'Pension',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Logo_Kumpulan_Wang_Simpanan_Pekerja.svg/1200px-Logo_Kumpulan_Wang_Simpanan_Pekerja.svg.png',
  '马来西亚法定强制养老退休金计划 (Akaun 1 / 2 / 3)',
  'MYR',
  '[{"name":"EPF Akaun Persaraan (Akaun 1)","productType":"Investment","currency":"MYR"},{"name":"EPF Akaun Sejahtera (Akaun 2)","productType":"Investment","currency":"MYR"},{"name":"EPF Akaun Fleksibel (Akaun 3)","productType":"Savings","currency":"MYR"}]',
  1,
  350
),
(
  'Interactive Brokers (盈透证券)',
  'Investment',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Interactive_Brokers_Logo.svg/2560px-Interactive_Brokers_Logo.svg.png',
  '全球领先在线券商，支持美股、港股、全球ETF及多币种现金管理',
  'USD',
  '[{"name":"IBKR 美股持仓 (Stocks/ETFs)","productType":"Stock","currency":"USD"},{"name":"IBKR 美元未结现金 (USD Cash)","productType":"Savings","currency":"USD"}]',
  1,
  180
),
(
  'Moomoo (富途马来西亚)',
  'Investment',
  'https://upload.wikimedia.org/wikipedia/en/thumb/5/52/Moomoo_logo.svg/1200px-Moomoo_logo.svg.png',
  '合规互联网券商，支持马股 (Bursa) 与美股交易及现金宝理财',
  'MYR',
  '[{"name":"Moomoo 马股/美股资产","productType":"Stock","currency":"MYR"},{"name":"Moomoo 现金宝 (Cash Plus)","productType":"Investment","currency":"MYR"}]',
  1,
  145
),
(
  'Binance (币安)',
  'Crypto',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Binance_Logo.svg/1200px-Binance_Logo.svg.png',
  '全球最大加密货币交易平台，支持现货、理财及冷热钱包资产',
  'USDT',
  '[{"name":"Binance 现货持仓 (Spot)","productType":"Crypto","currency":"USDT"},{"name":"Binance 活期理财 (Earn)","productType":"Crypto","currency":"USDT"}]',
  1,
  190
),
(
  'Wise (原 TransferWise)',
  'Forex',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Wise_Logo_%282023%29.svg/2560px-Wise_Logo_%282023%29.svg.png',
  '全球多币种跨国账户，提供真实汇率与多国本地银行账号',
  'USD',
  '[{"name":"Wise 美元多币种余额 (USD)","productType":"Savings","currency":"USD"},{"name":"Wise 新币多币种余额 (SGD)","productType":"Savings","currency":"SGD"},{"name":"Wise 马币余额 (MYR)","productType":"Savings","currency":"MYR"}]',
  1,
  175
),
(
  'StashAway (智能投顾)',
  'Investment',
  'https://images.seeklogo.com/logo-png/43/1/stashaway-logo-png_seeklogo-434077.png',
  '数字化理财与全球资产配置工具 (ERAA 智能算法组合)',
  'MYR',
  '[{"name":"StashAway 全球投资组合","productType":"Investment","currency":"MYR"},{"name":"StashAway Simple (现金管理)","productType":"Investment","currency":"MYR"}]',
  1,
  88
),
(
  '个人随身现金与小金库',
  'Cash',
  'https://cdn-icons-png.flaticon.com/512/2489/2489756.png',
  '家庭现金备用金、实体钱包与应急纸币储备',
  'MYR',
  '[{"name":"实体钱包/备用现金 (Cash)","productType":"Cash","currency":"MYR"}]',
  1,
  60
);
