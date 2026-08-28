# 一、这个第三个 Sub-App 应该解决什么问题

你的目标本质上不是“记账”，而是建立一个：

> **Monthly Financial Overview / 资产配置追踪系统**

核心层级应该是：

```text
我的全部资金
│
├── Platform / 平台
│   ├── Product / 产品
│   │   └── Monthly Balance / 月末余额
│   ├── Product
│   └── Product
│
├── Platform
│   ├── Product
│   └── Product
│
└── Platform
```

例如：

```text
Hong Leong Bank
├── Savings
├── Fixed Deposit
└── Current Account

Maybank
├── Savings
└── Fixed Deposit

IBKR
└── Cash

Other
└── E-Wallet
```

最终系统回答的是：

> **“我现在一共有多少钱？”**

> **“这些钱分别放在哪里？”**

> **“Hong Leong 占我的总资金多少？”**

> **“Savings / Fixed Deposit 各占多少？”**

> **“过去 12 个月资金是增加还是减少？”**

> **“这个月比上个月多了多少？”**

> **“我的资产配置有没有偏离目标？”**

---

# 二、最重要的设计：不要只记录 Current Balance

这是整个系统最关键的地方。

不要设计成：

```text
Product
└── current_balance
```

因为你未来会无法正确回答：

> 2026 年 1 月我有多少钱？

应该保存每个月的历史快照：

```text
Hong Leong
└── Savings
    ├── 2026-01 → RM 5,000
    ├── 2026-02 → RM 5,500
    ├── 2026-03 → RM 6,200
    └── 2026-04 → RM 6,800
```

所以数据模型必须是：

```text
Platform
   ↓
Product
   ↓
Monthly Snapshot
```

这也是为什么你的资金曲线、月度比较、平台占比都可以从历史数据准确计算出来。

---

# 三、完整功能规划

## 1. Dashboard —— 最重要的首页

打开 Sub-App 第一眼应该直接看到：

```text
Monthly Financial Overview

Total Assets
RM 128,520.00

↑ RM 5,240.00
+4.24% vs last month
```

下面：

```text
Platform Allocation

Hong Leong Bank       RM 42,500    33.1%
Maybank               RM 25,000    19.4%
IBKR                  RM 35,000    27.2%
Others                RM 26,020    20.3%
```

再下面：

```text
Asset Trend
━━━━━━━━━━━━━━━━━━━━
       ╭────╮
   ╭───╯    ╰────╮
───╯              ╰──
Jan Feb Mar Apr May Jun
```

然后：

```text
Top Changes This Month

Hong Leong Savings     +RM 2,000
IBKR Cash              +RM 1,500
Maybank FD             -RM 500
```

---

# 四、Platform 管理

Platform 是：

> **资金放在哪一个机构/平台**

例如：

```text
Hong Leong Bank
Maybank
CIMB
Interactive Brokers
Touch 'n Go
Rakuten Trade
```

每个平台应该可以设置：

```text
Name
Logo
Description
Display Order
Status
Notes
```

例如：

```text
Hong Leong Bank

[LOGO]

Savings
Fixed Deposit
```

### Logo

建议：

```text
logo_url
```

并提供：

* 上传/输入 Logo
* 图片预览
* 删除 Logo
* 默认 Logo
* 产品没有 Logo 时继承 Platform Logo

不要把大量图片直接塞进 SQLite/D1。

---

# 五、Product 管理

这是你的第二层。

例如：

```text
Hong Leong Bank
│
├── Savings
├── Fixed Deposit
└── Current Account
```

Product 应包含：

```text
Name
Platform
Product Type
Currency
Logo
Target Allocation
Active / Inactive
Notes
Display Order
```

例如：

| Platform   | Product       | Type         | Currency | Target |
| ---------- | ------------- | ------------ | -------- | -----: |
| Hong Leong | Savings       | Cash         | MYR      |    15% |
| Hong Leong | Fixed Deposit | Fixed Income | MYR      |    10% |
| IBKR       | Cash          | Cash         | USD      |    20% |

### Product Type

建议预设：

```text
Cash
Savings
Fixed Deposit
Investment
Brokerage
E-Wallet
Other
```

但要允许自定义。

---

# 六、Monthly Snapshot —— 核心数据入口

你每个月不需要重新创建产品。

例如选择：

```text
August 2026
```

系统自动显示：

```text
Monthly Balance — August 2026

Hong Leong Bank
────────────────────────────────

Savings
Previous: RM 8,500
Current:  [ RM 9,200 ]

Fixed Deposit
Previous: RM 20,000
Current:  [ RM 20,000 ]


Maybank
────────────────────────────────

Savings
Previous: RM 5,200
Current:  [ RM 5,800 ]
```

最后：

```text
Total
RM 35,000
```

---

# 七、非常建议加入「复制上个月」

这是 Vibe Coding 项目里非常值得做的 UX。

按钮：

```text
[ Copy Previous Month ]
```

例如：

```text
July

Savings       8,500
FD            20,000
IBKR          35,000
```

进入 August 后：

```text
Copy July Data
```

自动：

```text
Savings       8,500
FD            20,000
IBKR          35,000
```

你只修改变化的数字。

这样每月输入会非常快。

---

# 八、不要把“没有数据”当成 RM 0

这是数据逻辑里很重要的一条。

例如：

```text
July
Hong Leong Savings = RM 5,000
```

August 没输入。

不能自动理解：

```text
RM 0
```

因为：

> 没有记录 ≠ 余额为 0

应该显示：

```text
Not Reported
```

只有用户明确输入：

```text
0
```

才代表：

```text
RM 0
```

---

# 九、货币设计

即使现在主要使用 MYR，也建议数据库一开始支持：

```text
MYR
USD
SGD
HKD
EUR
GBP
JPY
...
```

每条月度余额保存：

```text
native_amount
currency
fx_rate_to_base
base_amount
```

例如：

```text
IBKR Cash

Native:
USD 5,000

FX:
1 USD = RM 4.25

Base:
RM 21,250
```

### 为什么 FX 必须记录在月度快照里？

因为：

```text
January
USD 1 = RM 4.60

August
USD 1 = RM 4.25
```

如果你每次查看历史数据都用“今天的汇率”，过去的资产曲线会不断变化。

正确方式是：

```text
2026-01
USD 5,000
FX 4.60
= RM 23,000

2026-08
USD 5,000
FX 4.25
= RM 21,250
```

因此历史数据不会被当前汇率重新计算。

第一版可以**手动输入 FX**。

未来再增加：

```text
Auto FX
```

---

# 十、资产配置统计

这是你这个 Sub-App 的核心价值之一。

## Platform Allocation

例如：

```text
Total Assets
RM 100,000

Hong Leong
RM 40,000
40%

Maybank
RM 20,000
20%

IBKR
RM 30,000
30%

Others
RM 10,000
10%
```

公式：

```text
Platform Allocation %
=
Platform Total / Total Assets × 100
```

---

# 十一、Product Allocation

进一步：

```text
Hong Leong
RM 40,000

Savings          RM 15,000
Fixed Deposit    RM 25,000
```

占全部资产：

```text
Savings        15%
Fixed Deposit  25%
```

占 Hong Leong：

```text
Savings        37.5%
Fixed Deposit  62.5%
```

这两个维度都建议提供。

---

# 十二、Target Allocation

为了真正帮助你做资产分配，我建议增加：

```text
Target Allocation %
```

例如：

| Platform   | Actual | Target | Difference |
| ---------- | -----: | -----: | ---------: |
| Hong Leong |    40% |    30% |       +10% |
| Maybank    |    20% |    25% |        -5% |
| IBKR       |    30% |    35% |        -5% |
| Others     |    10% |    10% |         0% |

显示：

```text
Hong Leong
Actual   40%
Target   30%
+10%
```

这样你不是单纯看数据，而是可以直接判断：

> 哪个平台资金太多 / 太少。

---

# 十三、必须具备的图表

## ① Total Asset Curve

最重要。

```text
X = Month
Y = Total Assets
```

例如：

```text
Jan  80k
Feb  84k
Mar  91k
Apr  89k
May  96k
Jun  102k
```

---

## ② Platform Balance Trend

多条曲线：

```text
Hong Leong
Maybank
IBKR
Others
```

X：

```text
Month
```

Y：

```text
Amount
```

用来观察：

> 哪个平台的钱在增长。

---

## ③ Platform Allocation

当前月份：

```text
Hong Leong    35%
Maybank       25%
IBKR          30%
Others        10%
```

可以使用 Donut/Pie。

---

## ④ Allocation Over Time

这个比单纯 Pie 更有价值。

例如：

```text
        HLB  Maybank  IBKR
Jan     40%   30%     30%
Feb     38%   31%     31%
Mar     35%   30%     35%
Apr     33%   28%     39%
```

可以做 Stacked Area/100% stacked chart。

让你看到：

> 我的资产配置结构有没有发生变化。

---

## ⑤ Monthly Change

```text
Jan → Feb     +5,000
Feb → Mar     +7,000
Mar → Apr     -2,000
```

Bar Chart。

---

## ⑥ Platform Monthly Comparison Table

这个是你明确需要的。

```text
Platform      Jan      Feb      Mar      Apr      May
---------------------------------------------------------
Hong Leong    20,000   22,000   21,500   25,000   27,000
Maybank       15,000   16,000   17,000   18,000   18,500
IBKR          30,000   31,500   35,000   34,000   38,000
Others        5,000    5,500    6,000    6,500    7,000
---------------------------------------------------------
Total         70,000   75,000   79,500   83,500   90,500
```

并支持：

* 横向滚动
* Sticky first column
* 月份筛选
* Platform 展开
* Product 子行

例如：

```text
Hong Leong       RM 42,500
  ├─ Savings     RM 12,500
  └─ FD          RM 30,000
```

---

# 十四、建议的数据库结构

如果你目前已经有 Users/Auth，**不要重复建立用户系统**。

建议这个 Sub-App 最核心的表：

```text
financial_platforms
financial_products
financial_periods
financial_snapshots
```

### financial_platforms

```text
id
user_id
name
logo_url
description
is_active
sort_order
created_at
updated_at
```

### financial_products

```text
id
user_id
platform_id
name
product_type
currency
logo_url
target_allocation_pct
is_active
sort_order
notes
created_at
updated_at
```

### financial_periods

```text
id
user_id
month_key
status
notes
created_at
updated_at
```

例如：

```text
2026-01
2026-02
2026-03
```

### financial_snapshots

```text
id
user_id
period_id
product_id

native_amount
currency
fx_rate_to_base
base_amount

notes
created_at
updated_at
```

最重要的约束：

```text
UNIQUE(period_id, product_id)
```

同一个月、同一个 Product 只能存在一条余额记录。

Cloudflare D1 使用 SQLite 语义，并支持 foreign keys；这种 `platform → product → snapshot` 的关系适合用 FK 来保证数据完整性。([Cloudflare Docs][1])

常用查询字段，例如 `user_id`、`platform_id`、`product_id`、`month_key`，应根据实际查询方式建立索引，以减少 D1 扫描数据量。([Cloudflare Docs][2])

---

# 十五、页面结构

我建议第三个 Sub-App 做成：

```text
Financial Overview
│
├── Dashboard
│
├── Monthly Data
│
├── Platforms
│
├── Products
│
└── Analytics
```

### Dashboard

```text
Total Assets
Monthly Change
Allocation
Asset Curve
Platform Distribution
```

### Monthly Data

负责输入：

```text
January
February
March
...
```

### Platforms

管理：

```text
Hong Leong
Maybank
IBKR
...
```

### Products

管理：

```text
Savings
Fixed Deposit
Cash
...
```

### Analytics

专门看：

```text
Historical Trend
Platform Comparison
Allocation
Monthly Change
Target vs Actual
```

---

# 十六、推荐的操作流程

你的实际使用应该尽量简单：

```text
第一次使用
      ↓
建立 Platform
      ↓
建立 Product
      ↓
输入当前月份资金
      ↓
Dashboard 自动统计
```

下个月：

```text
打开 Monthly Data
      ↓
选择 August
      ↓
Copy July
      ↓
修改变化的数据
      ↓
Save
      ↓
Dashboard 自动更新
```

你不应该每个月重新建立：

```text
Hong Leong
Savings
```

这些都是长期存在的 Master Data。

每个月只新增：

```text
Snapshot
```

---

# 十七、以后可以扩展的功能

第一版不要全部做。

但数据库设计应该预留：

```text
Target Allocation
Notes
FX
Product Type
Account Identifier
Interest Rate
Maturity Date
```

未来可以做：

```text
FD Maturity Tracking
Interest Income
Investment Portfolio
Net Worth
Asset Class
Monthly Contribution
Monthly Withdrawal
Rebalancing Recommendation
```

也就是说以后这个 Sub-App 可以慢慢进化成：

> **Personal Wealth Dashboard**

---

# 十八、对 Vibe Coding 最重要的实现策略

不要让 Agent：

> “重新做一个财务系统。”

而应该告诉它：

```text
你是在我现有系统里面增加第三个 Sub-App。
不要破坏已有 Sub-App。
不要重新建立 Authentication。
不要重新建立 Admin。
复用现有 Design System。
复用现有 Database Layer。
复用现有 API Pattern。
复用现有 User/Role 权限体系。
```

这样 AI 不容易把你的整个项目越改越乱。

---

下面这一整套可以**直接复制给 Antigravity / 你的 AI Agent**。

# 第三个 Sub-App：Monthly Financial Overview

## 任务

在当前已有项目中，新增第三个 Sub-App：

**Monthly Financial Overview / 月度财务统计**

这个 Sub-App 的核心目标不是传统记账，而是：

> 统一记录我分散在不同平台、不同金融产品中的资金，并通过月度历史快照统计总资产、平台分配、产品分配、月度变化和资金曲线，帮助我进行资产配置管理。

这是一个长期使用的个人资产统计系统。

---

# 0. 非常重要：先审计，不要直接重写

在开始任何代码修改之前，先完整检查当前项目：

```text
1. Project structure
2. Existing Sub-Apps
3. Existing routing
4. Existing authentication
5. Existing users table
6. Existing role/admin system
7. Existing API architecture
8. Existing database architecture
9. Existing D1 binding
10. Existing SQLite/D1 migrations
11. Existing UI design system
12. Existing components
13. Existing chart library
14. Existing deployment configuration
15. Existing documentation
```

特别检查：

```text
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/API.md
AGENTS.md
```

如果这些文件不存在，先分析当前项目后再建立。

---

# 1. 不允许破坏现有系统

这是新增 Sub-App，不是重写项目。

必须：

```text
Preserve existing features.
Preserve existing Sub-Apps.
Preserve existing authentication.
Preserve existing admin system.
Preserve existing routing.
Preserve existing database data.
Preserve existing API behavior.
Preserve existing UI patterns.
```

禁止：

```text
重新建立 Authentication
重新建立 User System
重新建立 Admin System
重新建立完全不同的 Design System
随意修改旧数据库 migration
重写整个项目
删除现有功能
```

如果需要修改现有基础架构，使用最小改动。

---

# 2. 复用现有 Authentication

当前系统已经存在 User/Admin 体系。

这个 Sub-App 不应该建立第二套用户系统。

必须使用当前登录用户。

数据必须按照：

```text
user_id
```

进行隔离。

普通 User：

```text
只能访问自己的 Financial Overview 数据。
```

Admin：

```text
可以正常作为自己的 User 使用 Financial Overview。

同时如果当前 Admin 权限体系允许，可以从现有 Admin 系统管理其他用户。
```

不要建立新的 Admin Login。

---

# 3. Sub-App 定义

建立：

```text
Monthly Financial Overview
```

如果项目已有 Sub-App navigation，请把它作为：

```text
Sub-App #3
```

加入现有导航。

不要破坏前两个 Sub-App。

---

# 4. 核心数据层级

采用以下模型：

```text
User
 │
 └── Financial Platforms
        │
        ├── Product
        │
        ├── Product
        │
        └── Product
              │
              ├── Monthly Snapshot
              ├── Monthly Snapshot
              └── Monthly Snapshot
```

概念必须区分：

## Platform

资金所属的平台/机构。

例如：

```text
Hong Leong Bank
Maybank
CIMB
Interactive Brokers
Touch 'n Go
```

## Product

平台里面具体的金融产品。

例如：

```text
Hong Leong Bank
├── Savings
├── Fixed Deposit
└── Current Account
```

## Monthly Snapshot

某一个 Product 在某一个月份的月度余额。

例如：

```text
Hong Leong Savings

2026-01 → RM 5,000
2026-02 → RM 5,500
2026-03 → RM 6,200
```

---

# 5. 关键业务原则：历史数据必须独立保存

绝对不要只设计：

```text
product.current_balance
```

然后尝试推算历史。

必须使用：

```text
Product
+
Monthly Snapshot
```

因为系统必须支持：

```text
过去任意月份的资产统计
历史资金曲线
历史平台比较
历史资产占比
Month-over-Month Change
```

---

# 6. Database Schema

根据现有数据库命名规范创建。

建议核心表：

```text
financial_platforms
financial_products
financial_periods
financial_snapshots
```

如果项目已有统一 `users`，不要重新建立用户表。

---

# 7. financial_platforms

建议字段：

```text
id
user_id
name
logo_url
description
is_active
sort_order
created_at
updated_at
```

用途：

保存平台信息。

例如：

```text
Hong Leong Bank
```

支持：

* Name
* Logo
* Description
* Active / Inactive
* Sort Order

Logo 以 URL/reference 为主。

不要把大型图片 Blob 随意直接存进 D1。

如果当前项目已有文件上传系统，复用现有系统。

---

# 8. financial_products

建议字段：

```text
id
user_id
platform_id
name
product_type
currency
logo_url
target_allocation_pct
is_active
sort_order
notes
created_at
updated_at
```

例如：

```text
Platform:
Hong Leong Bank

Product:
Savings

Product Type:
Savings

Currency:
MYR

Target Allocation:
15%
```

---

# 9. Product Type

第一版提供：

```text
Cash
Savings
Fixed Deposit
Investment
Brokerage
E-Wallet
Other
```

但是不要硬编码到无法扩展。

应该允许未来增加新的 Product Type。

---

# 10. Logo

Platform 必须支持 Logo。

Product 可以：

```text
Own Logo
```

也可以：

```text
Inherit Platform Logo
```

推荐显示逻辑：

```text
Product Logo exists
    ↓
Use Product Logo

否则
    ↓
Use Platform Logo

否则
    ↓
Use default icon
```

---

# 11. Currency

系统必须支持多币种。

每个 Product 指定：

```text
currency
```

例如：

```text
MYR
USD
SGD
HKD
EUR
```

不要假设所有资产都是 MYR。

---

# 12. Base Currency

系统需要一个统一统计币种。

默认可以：

```text
MYR
```

但必须通过 Settings 可调整。

例如：

```text
Base Currency: MYR
```

所有 Dashboard 的总资产和图表默认以 Base Currency 统计。

---

# 13. financial_periods

建议：

```text
id
user_id
month_key
status
notes
created_at
updated_at
```

month_key 采用：

```text
YYYY-MM
```

例如：

```text
2026-01
2026-02
2026-03
```

必须建立唯一约束：

```text
UNIQUE(user_id, month_key)
```

---

# 14. financial_snapshots

建议：

```text
id
user_id
period_id
product_id

native_amount
currency
fx_rate_to_base
base_amount

notes

created_at
updated_at
```

核心约束：

```text
UNIQUE(period_id, product_id)
```

含义：

一个 Product 在同一个月份只能有一个 Snapshot。

---

# 15. FX 处理

如果：

```text
currency = Base Currency
```

则：

```text
fx_rate_to_base = 1
```

例如：

```text
USD 5,000
FX = 4.25
Base = MYR

base_amount = RM 21,250
```

必须保存当月使用的：

```text
fx_rate_to_base
```

不要每次查看历史数据时使用今天的 FX 重新计算历史资产。

第一版：

```text
Manual FX Input
```

即可。

未来再考虑自动 FX API。

---

# 16. Missing Data 规则

非常重要：

```text
No snapshot
≠
Zero balance
```

如果某个 Product 没有输入该月份数据：

显示：

```text
Not Reported
```

不要自动变成：

```text
RM 0
```

只有用户明确输入：

```text
0
```

才表示该月余额为零。

---

# 17. Dashboard

建立：

```text
/financial
```

或者按照当前项目路由规范命名。

Dashboard 必须提供：

## Total Assets

例如：

```text
Total Assets

RM 128,520.00
```

---

## Monthly Change

```text
+RM 5,240.00
+4.24%
vs previous month
```

计算：

```text
current_total - previous_total
```

以及：

```text
(current_total - previous_total)
/
previous_total
× 100
```

如果没有上个月数据：

显示：

```text
N/A
```

不要计算错误的百分比。

如果 previous total = 0：

不能除以 0。

显示：

```text
N/A
```

---

# 18. Platform Allocation

Dashboard 显示：

```text
Hong Leong Bank
RM 42,500
33.1%

Maybank
RM 25,000
19.4%

IBKR
RM 35,000
27.2%

Others
RM 26,020
20.3%
```

公式：

```text
platform_total / total_assets × 100
```

---

# 19. Product Allocation

支持切换：

```text
By Platform
By Product
```

例如：

```text
Savings
RM 20,000
15.6%

Fixed Deposit
RM 35,000
27.2%

Investment
RM 40,000
31.1%
```

---

# 20. Target Allocation

每个平台和产品可以配置：

```text
target_allocation_pct
```

Dashboard 或 Analytics 显示：

```text
Platform       Actual     Target      Difference

Hong Leong     40%        30%         +10%
Maybank        20%        25%         -5%
IBKR           30%        35%         -5%
Others         10%        10%          0%
```

Difference：

```text
actual - target
```

这个功能用于帮助资产分配。

不要自动执行转账或交易。

它只是分析工具。

---

# 21. Monthly Data Page

建立：

```text
Monthly Data
```

顶部：

```text
Month:
[ August 2026 ▼ ]

[ Copy Previous Month ]
[ Save ]
```

数据显示为：

```text
Platform / Product
Previous
Current
Change
Change %
```

例如：

```text
Hong Leong Bank

Savings
Previous: RM 8,500
Current:  RM 9,200
Change:   +RM 700
+8.24%

Fixed Deposit
Previous: RM 20,000
Current:  RM 20,000
Change:   RM 0
0%
```

---

# 22. Copy Previous Month

这是非常重要的功能。

例如：

```text
July
```

点击：

```text
Copy Previous Month
```

自动把 July 的 Snapshot 复制成 August 草稿数据。

然后用户只修改变化的项目。

注意：

不能覆盖 August 已经存在的数据而不提示。

必须：

```text
如果目标月份已有数据：

显示确认。

例如：

"August already contains data. Do you want to overwrite existing snapshot values?"
```

---

# 23. Monthly Status

建议：

```text
draft
finalized
```

默认：

```text
draft
```

完成月度录入后可以：

```text
Finalize Month
```

Finalized 后：

* 普通编辑入口减少
* 防止误修改
* 如果需要修改，要求明确操作

不要实现过于复杂的会计结账系统。

---

# 24. Platforms Page

建立：

```text
Platforms
```

列表：

```text
┌─────────────────────────────────────────┐
│ Logo  Hong Leong Bank                   │
│       3 Products                        │
│       RM 42,500                         │
│                         [Edit] [View]   │
└─────────────────────────────────────────┘
```

支持：

```text
Create
Edit
Deactivate
Reorder
Logo
View Products
```

不要轻易 Physical Delete。

如果已有历史 Snapshot：

优先使用：

```text
is_active = false
```

---

# 25. Products Page

支持：

```text
Create
Edit
Deactivate
Reorder
Product Logo
Product Type
Currency
Target Allocation
Notes
```

如果 Product 已经存在历史数据：

不要直接删除导致历史数据断裂。

使用：

```text
is_active = false
```

---

# 26. Analytics Page

建立：

```text
Analytics
```

提供：

```text
1. Total Asset Trend
2. Platform Balance Trend
3. Platform Allocation
4. Allocation Over Time
5. Monthly Change
6. Monthly Comparison Table
7. Target vs Actual
```

---

# 27. Chart 1 — Total Asset Curve

必须有：

```text
Total Asset Trend
```

X：

```text
Month
```

Y：

```text
Base Currency Amount
```

必须按时间排序。

例如：

```text
Jan
Feb
Mar
Apr
May
Jun
```

不要把月份按照字符串错误排序。

---

# 28. Chart 2 — Platform Balance Trend

允许选择：

```text
All Platforms
```

或者单独选择：

```text
Hong Leong
Maybank
IBKR
```

显示多条时间曲线。

---

# 29. Chart 3 — Current Platform Allocation

显示当前选定月份：

```text
Platform Share of Total Assets
```

建议使用：

```text
Donut
```

或当前项目已有等价图表组件。

---

# 30. Chart 4 — Allocation Over Time

目标：

查看资产结构随时间变化。

例如：

```text
Hong Leong
Maybank
IBKR
Others
```

按照百分比展示。

可以使用：

```text
100% Stacked Area
```

或其他等价图表。

---

# 31. Chart 5 — Monthly Change

显示：

```text
Month-over-Month Change
```

例如：

```text
Jan → Feb
Feb → Mar
Mar → Apr
```

使用 Bar Chart。

---

# 32. Monthly Comparison Table

必须实现一个非常重要的表格：

```text
Platform / Product | Jan | Feb | Mar | Apr | May | Jun
```

例如：

```text
Hong Leong              20k   22k   21k   25k   27k   30k
  Savings                8k    9k    9k   10k   11k   12k
  Fixed Deposit          12k   13k   12k   15k   16k   18k

Maybank                 15k   16k   17k   18k   18k   19k

IBKR                    30k   31k   35k   34k   38k   40k

Total                   65k   69k   73k   77k   83k   89k
```

要求：

* Horizontal scrolling
* Sticky first column
* Platform expandable/collapsible
* Product nested under Platform
* Monthly totals
* Current month highlight
* Change indication
* Responsive design

---

# 33. Filters

Analytics 支持：

```text
Date Range
Platform
Product
Product Type
Currency
```

例如：

```text
Jan 2026 → Aug 2026
```

或者：

```text
Hong Leong only
```

---

# 34. Financial Summary Calculations

实现以下计算。

## Total Assets

```text
SUM(base_amount)
```

按照：

```text
user
+
month
```

聚合。

---

## Platform Total

```text
SUM(base_amount)
GROUP BY platform
```

---

## Product Total

```text
SUM(base_amount)
GROUP BY product
```

---

## Platform Allocation

```text
platform_total / total_assets * 100
```

---

## Product Allocation

```text
product_total / total_assets * 100
```

---

## MoM Change

```text
current_month - previous_month
```

---

## MoM %

```text
change / previous_month * 100
```

如果 previous = 0：

```text
N/A
```

---

## Target Difference

```text
actual_allocation - target_allocation
```

---

# 35. Performance

不要每打开 Dashboard 都执行大量无关查询。

可以根据需求设计：

```text
Aggregated SQL Queries
```

例如：

```text
monthly total
platform total
product total
trend data
```

优先让 SQL 完成 aggregation，而不是拉出大量数据后全部在 frontend 计算。

Cloudflare D1 支持 SQLite 语义以及 Worker Binding API，因此可以直接通过 SQL 聚合相关数据。([Cloudflare Docs][1])

根据查询方式给常用过滤/连接字段建立合理索引。([Cloudflare Docs][2])

---

# 36. API Design

根据当前项目 API 规范建立对应接口。

建议：

```text
GET    /api/financial/dashboard

GET    /api/financial/platforms
POST   /api/financial/platforms
PATCH  /api/financial/platforms/:id
POST   /api/financial/platforms/:id/deactivate

GET    /api/financial/products
POST   /api/financial/products
PATCH  /api/financial/products/:id
POST   /api/financial/products/:id/deactivate

GET    /api/financial/months
GET    /api/financial/months/:month

POST   /api/financial/months/:month/copy-previous

GET    /api/financial/snapshots
POST   /api/financial/snapshots
PATCH  /api/financial/snapshots/:id

GET    /api/financial/analytics
```

实际命名以项目现有 API 风格为准。

不要机械复制这个命名。

---

# 37. Authorization

所有数据必须按照当前登录用户隔离。

例如：

```text
user A
```

绝不能通过 API 查询：

```text
user B
```

Frontend 隐藏按钮不算权限控制。

Backend 必须验证：

```text
authenticated user
+
resource belongs to current user
```

Admin API 如果已有系统权限设计，则继续复用。

---

# 38. Database Safety

所有 Database Schema 修改：

```text
必须创建新的 migration
```

不要修改已经执行的旧 migration。

例如：

```text
001_create_financial_platforms.sql
002_create_financial_products.sql
003_create_financial_periods.sql
004_create_financial_snapshots.sql
005_add_target_allocation.sql
```

实际编号根据当前项目 migration 顺序决定。

---

# 39. Foreign Keys

建立：

```text
financial_products.platform_id
    → financial_platforms.id

financial_periods.user_id
    → users.id

financial_snapshots.period_id
    → financial_periods.id

financial_snapshots.product_id
    → financial_products.id
```

使用 foreign key 保证引用关系有效。

Cloudflare D1 支持 foreign key enforcement，因此优先使用数据库级约束，而不是完全依赖 JavaScript。([Cloudflare Docs][3])

---

# 40. Delete Strategy

不要直接删除有历史记录的：

```text
Platform
Product
```

优先：

```text
is_active = false
```

这样：

```text
2026-01
2026-02
2026-03
```

的历史数据仍然完整。

只有确认没有任何历史引用的数据，才考虑 physical delete。

---

# 41. UI Design

严格复用当前项目的 Design System。

如果当前系统已经使用：

```text
Glassmorphism
Soft UI
Minimal
Premium Dashboard
Rounded Cards
```

继续使用，而不要重新发明设计。

要求：

```text
Minimal
Premium
Clean
Information-dense but readable
Responsive
Desktop-first
Mobile-friendly
```

Dashboard 优先展示重要数字。

不要使用大量装饰元素。

---

# 42. Dashboard Layout

推荐：

```text
┌─────────────────────────────────────────────────┐
│ Monthly Financial Overview                      │
│ August 2026 ▼                                   │
├─────────────────────────────────────────────────┤
│ Total Assets       Monthly Change     Allocation│
│ RM 128,520         +RM 5,240         100%       │
├─────────────────────────────────────────────────┤
│                                                 │
│              Total Asset Trend                  │
│                                                 │
├────────────────────────┬────────────────────────┤
│ Platform Allocation    │ Monthly Changes        │
│                        │                        │
├────────────────────────┴────────────────────────┤
│ Platform / Product Monthly Comparison           │
└─────────────────────────────────────────────────┘
```

---

# 43. Data Entry UX

月度录入必须尽量减少操作。

优先：

```text
Choose Month
↓
Copy Previous Month
↓
Edit Changed Values
↓
Save
```

不要要求用户逐条重新建立 Product。

---

# 44. Input Validation

必须验证：

```text
amount >= 0
fx_rate > 0
target_allocation >= 0
target_allocation <= 100
month_key valid
currency valid
platform exists
product exists
product belongs to current user
```

禁止：

```text
NaN
Infinity
negative balance
invalid month
```

是否允许负资产必须按照明确的业务模型处理。

第一版默认：

```text
balance >= 0
```

---

# 45. Currency Formatting

所有金额显示统一使用：

```text
Currency
Amount
```

例如：

```text
RM 12,500.00
USD 5,000.00
```

Dashboard 总资产统一使用 Base Currency。

详细产品页面可以同时显示：

```text
Native Amount
Converted Amount
FX Rate
```

---

# 46. Empty States

首次使用：

```text
No financial data yet.

Create your first platform.
```

无 Product：

```text
No products under this platform.
```

无月度数据：

```text
No snapshot recorded for this month.
```

不要展示大量空白图表。

---

# 47. Error Handling

API 出错时：

不要只显示：

```text
Error
```

显示用户可理解的信息。

例如：

```text
Unable to save August balance.
Please try again.
```

同时在开发环境记录实际 error。

---

# 48. Testing

至少测试：

## User Isolation

```text
User A
不能读取
User B
数据
```

## Platform

```text
Create
Edit
Deactivate
Logo
```

## Product

```text
Create
Edit
Deactivate
Platform association
Currency
Target allocation
```

## Snapshot

```text
Create
Edit
Update
Copy previous month
```

## Calculations

测试：

```text
Total
Platform Total
Product Total
Allocation
MoM
MoM %
Target Difference
FX conversion
```

---

# 49. Edge Cases

必须测试：

```text
只有一个 Platform

一个 Platform 多个 Product

没有 Product Snapshot

部分 Product 有数据，部分没有

余额 = 0

Previous month = 0

第一个月没有 Previous Month

不同 Currency

FX rate = 1

新增 Product

Deactivate Product

Deactivate Platform

删除/停用之后仍然存在历史数据
```

---

# 50. Performance

如果历史月份越来越多：

不要无限制一次返回所有明细。

Analytics 支持：

```text
Date range
Pagination where appropriate
Aggregation
```

数据库查询要尽量使用：

```text
indexed user_id
indexed period_id
indexed product_id
indexed month_key
```

具体 index 根据实际 SQL 查询计划决定，不要无意义地建立大量 index。

---

# 51. Documentation

更新：

```text
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/API.md
```

记录这个 Sub-App。

至少包括：

```text
Purpose
Architecture
Database
Data model
Calculation rules
Currency rules
Snapshot rules
API
Authorization
Analytics
```

---

# 52. AGENTS.md

更新 Agent Rules：

```text
Financial data is historical data.

Do not replace monthly snapshots with a current_balance-only model.

Never interpret missing snapshot as zero.

Do not modify old migrations.

Do not delete historical financial data by default.

Platform is parent of Product.

Product belongs to Platform.

Snapshot belongs to Product + Month.

Historical FX rate must be preserved.

Always scope financial data to authenticated user.

Never bypass backend authorization.
```

---

# 53. Important Architectural Rule

不要把：

```text
Platform
```

和：

```text
Product
```

混成一个 table。

正确：

```text
Platform
    ↓
Product
    ↓
Monthly Snapshot
```

例如：

```text
Hong Leong Bank
├── Savings
│   ├── Jan 2026
│   ├── Feb 2026
│   └── Mar 2026
│
└── Fixed Deposit
    ├── Jan 2026
    ├── Feb 2026
    └── Mar 2026
```

---

# 54. 不要把 Analytics 数据永久重复保存

除非性能测试证明需要。

优先：

```text
Raw Snapshot Data
        ↓
SQL aggregation
        ↓
Analytics
```

不要同时保存：

```text
snapshot
+
monthly_total
+
platform_total
+
allocation_total
```

然后让这些数字长期互相不同步。

核心原则：

> Snapshot 是 Source of Truth。

统计结果应该尽可能从 Snapshot 派生。

---

# 55. 第一阶段 MVP

第一阶段只做：

```text
1. Platform Management
2. Product Management
3. Monthly Snapshot
4. Copy Previous Month
5. Total Assets
6. Platform Allocation
7. Product Allocation
8. Total Asset Trend
9. Platform Comparison Table
10. Monthly Change
11. Multi-currency Base Conversion
```

---

# 56. 第二阶段

之后增加：

```text
1. Target Allocation
2. Actual vs Target
3. Allocation Over Time
4. Platform Trend
5. Product Trend
6. Advanced Filters
7. Finalize Month
8. Better Analytics
```

---

# 57. 第三阶段

未来可以增加：

```text
1. FD Maturity Tracking
2. Interest Rate
3. Interest Income
4. Investment Portfolio
5. Net Worth
6. Asset Class
7. Monthly Contribution
8. Monthly Withdrawal
9. Rebalancing Suggestions
10. Export CSV
11. Export PDF
```

不要在第一阶段全部实现。

---

# 58. Vibe Coding 执行流程

不要一次修改整个系统。

按照：

```text
Phase 1
Audit current system

↓

Phase 2
Design database schema

↓

Phase 3
Create migrations

↓

Phase 4
Implement backend/API

↓

Phase 5
Implement Platform management

↓

Phase 6
Implement Product management

↓

Phase 7
Implement Monthly Snapshot

↓

Phase 8
Implement Dashboard

↓

Phase 9
Implement Analytics

↓

Phase 10
Testing

↓

Phase 11
Documentation
```

每个阶段完成后确认现有项目没有被破坏。

---

# 59. Git 安全

在开始修改之前：

```text
Check git status
```

不要覆盖未提交的用户工作。

完成一个稳定阶段后：

```text
git diff
```

检查修改。

建议形成清晰 commit：

```text
Add financial platform management
Add financial product management
Add monthly snapshot tracking
Add financial dashboard
Add financial analytics
```

不要把所有修改塞进一个无法回滚的大 commit。

---

# 60. 最终验收标准

只有满足以下条件才算完成。

## Data

```text
可以创建 Platform
可以创建 Product
可以记录月度余额
可以修改月度余额
可以复制上个月
可以支持历史月份
可以支持多币种
可以使用历史 FX
```

## Analytics

```text
可以看到总资产
可以看到月度变化
可以看到平台资金
可以看到产品资金
可以看到平台占比
可以看到产品占比
可以看到资金曲线
可以看到平台月度比较
可以看到 Allocation Trend
```

## Security

```text
User data isolation works
Admin permissions work
Frontend checks are not the only protection
```

## Data integrity

```text
No duplicate monthly snapshot for same product
No broken foreign keys
No accidental historical deletion
No missing-vs-zero confusion
```

---

# 61. 最终 Agent 汇报格式

完成后必须向我汇报：

## Architecture

```text
当前 Sub-App 如何接入整个系统
```

## Database

列出：

```text
Tables
Columns
Foreign Keys
Indexes
Unique Constraints
Migrations
```

## API

列出：

```text
Endpoint
Method
Purpose
Authorization
```

## UI

列出：

```text
Pages
Components
Dashboard
Charts
Forms
```

## Calculations

解释：

```text
Total Assets
Platform Allocation
Product Allocation
MoM
Target Difference
FX Conversion
```

## Testing

告诉我实际测试了什么。

## Files Changed

列出所有修改/新增文件。

## Risks

列出剩余风险。

## TODO

列出下一阶段建议。

---

# 最终原则

始终遵守：

```text
This is an additional Sub-App, not a rewrite.

Reuse existing authentication.

Reuse existing user system.

Reuse existing admin system.

Reuse existing design system.

Platform != Product.

Product != Snapshot.

Snapshot is the source of truth.

Missing data != zero.

Historical FX must remain historical.

Historical financial data must not be casually deleted.

Database changes must use migrations.

Backend must enforce authorization.

Keep calculations consistent.

Prefer derived analytics over duplicated stored totals.

Keep the system simple enough for long-term Vibe Coding.
```

[1]: https://developers.cloudflare.com/d1/sql-api/sql-statements/?utm_source=chatgpt.com "SQL statements · Cloudflare D1 docs"
[2]: https://developers.cloudflare.com/d1/best-practices/use-indexes/?utm_source=chatgpt.com "Use indexes · Cloudflare D1 docs"
[3]: https://developers.cloudflare.com/d1/sql-api/foreign-keys/?utm_source=chatgpt.com "Define foreign keys · Cloudflare D1 docs"
