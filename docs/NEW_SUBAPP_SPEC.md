标题：垫付 / 往来账管理 Sub-App —— 完整系统架构与实现规范

你现在负责实现我的 Toolbox 中第二个 Sub-App：

【Sub-App 名称】
垫付管理 / Advance Manager

【核心目标】
这是一个“人与人之间垫付、分摊、欠款、还款、结算”的完整管理系统。

它不是普通 Expense Tracker。

系统最核心的问题是：

1. 谁付了钱
2. 付了多少钱
3. 为什么付
4. 哪些人涉及这笔费用
5. 每个人应该承担多少钱
6. 每个人已经支付多少钱
7. 每个人还欠多少钱
8. 谁欠我钱
9. 我欠谁钱
10. 已经还了多少
11. 什么时候还的
12. 当前最终净余额是多少

系统必须围绕“债务关系”和“结算”设计，而不是只围绕“消费记录”设计。


==================================================
一、技术栈与开发约束
==================================================

前端：

HTML
CSS
Vanilla JavaScript

不要使用 React / Vue / Angular / Next.js，除非我明确要求。

后端：

Cloudflare Workers

数据库：

Cloudflare D1 / SQLite

原则：

Frontend
↓
API
↓
Cloudflare Worker
↓
SQLite / D1

前端绝对不能直接操作数据库。

所有数据读取、创建、修改、删除必须经过 API。

API 必须负责：

- Authentication
- Authorization
- Validation
- Business Logic
- Database Access
- Calculation
- Transaction
- Error Handling


==================================================
二、整个系统的核心设计原则
==================================================

必须遵守：

1. Data First
2. Database First
3. Business Logic First
4. API First
5. UI Last

开发顺序：

Database Schema
↓
Data Model
↓
Business Rules
↓
API
↓
Validation
↓
Frontend State
↓
UI
↓
Statistics
↓
Optimization

不要先堆 UI 再反推数据库。


==================================================
三、系统架构
==================================================

系统分成：

Toolbox
└── Advance Manager
    ├── Dashboard
    ├── Expenses
    ├── People
    ├── Projects
    ├── Settlements
    ├── Statistics
    └── Settings


逻辑层：

UI
↓
API Client
↓
Cloudflare Worker Router
↓
Auth Middleware
↓
Validation
↓
Business Service
↓
Repository / DB Layer
↓
SQLite / D1


前端必须采用模块化 JS。

建议：

/js
    api.js
    auth.js
    state.js
    router.js
    utils.js
    formatters.js
    validators.js

    modules/
        dashboard.js
        expenses.js
        persons.js
        projects.js
        settlements.js
        statistics.js

    components/
        modal.js
        toast.js
        table.js
        form.js
        dropdown.js
        confirm.js

    pages/
        dashboard.js
        expenses.js
        expense-detail.js
        persons.js
        person-detail.js
        projects.js
        project-detail.js
        settlements.js
        statistics.js


==================================================
四、数据库设计
==================================================

不要把所有信息放在一个 expense table。

必须使用关系型结构。


--------------------------------------
TABLE 1: users
--------------------------------------

用途：

系统登录用户。

字段：

id
uuid / TEXT PRIMARY KEY

email
TEXT UNIQUE NOT NULL

name
TEXT NOT NULL

avatar_url
TEXT NULL

role
TEXT NOT NULL DEFAULT 'user'

status
TEXT NOT NULL DEFAULT 'active'

created_at
TEXT NOT NULL

updated_at
TEXT NOT NULL


role：

user
admin


status：

active
disabled


注意：

Admin 同时也是普通 User。

Admin 不应该变成另一种不能使用普通功能的账户。

Admin：

可以正常创建自己的 Expense
可以成为 Payer
可以成为 Participant
可以查看自己的 Dashboard
同时拥有 Admin 权限。


--------------------------------------
TABLE 2: persons
--------------------------------------

用途：

系统中的“涉及人物”。

注意：

Person 不等于 User。

User 是系统登录账号。

Person 是现实中的人。

例如：

John
Mary
Peter

这些人完全不需要拥有系统账号。


字段：

id
TEXT PRIMARY KEY

owner_user_id
TEXT NOT NULL

name
TEXT NOT NULL

nickname
TEXT NULL

phone
TEXT NULL

email
TEXT NULL

avatar_url
TEXT NULL

note
TEXT NULL

is_archived
INTEGER DEFAULT 0

created_at
TEXT NOT NULL

updated_at
TEXT NOT NULL


必须使用 owner_user_id 隔离不同用户的数据。


--------------------------------------
TABLE 3: categories
--------------------------------------

字段：

id
owner_user_id
name
icon
sort_order
is_archived
created_at
updated_at


系统默认分类：

Food
Transport
Accommodation
Shopping
Entertainment
Sports
Travel
Bills
Education
Healthcare
Other


用户可以自行创建分类。


--------------------------------------
TABLE 4: projects
--------------------------------------

用途：

旅行 / 聚餐 / 羽毛球 / 活动 / 项目。

字段：

id
owner_user_id
name
description
start_date
end_date
status
created_at
updated_at


status：

active
completed
archived


例如：

Langkawi Trip
Badminton
Dinner
Japan Trip


--------------------------------------
TABLE 5: expenses
--------------------------------------

这是主交易表。

字段：

id
owner_user_id

transaction_date

description

total_amount

currency

payer_person_id

category_id

project_id

payment_method

status

note

created_at

updated_at


推荐：

total_amount 使用整数最小货币单位保存。

例如：

RM 12.50

数据库保存：

1250

不要直接保存 FLOAT。

这样避免：

12.5
12.499999
之类的浮点误差。


currency：

MYR
USD
SGD
等。

默认：

MYR


payment_method：

cash
card
bank_transfer
ewallet
other


status：

unsettled
partial
settled
cancelled


payer_person_id：

必须指向 persons。


重要：

系统必须支持：

“我替别人付款”

也支持：

“别人替我付款”


--------------------------------------
TABLE 6: expense_participants
--------------------------------------

这是整个系统最重要的表之一。

一个 Expense 可以关联多个 Person。

字段：

id

expense_id

person_id

split_type

share_amount

percentage

paid_amount

balance_amount

created_at

updated_at


split_type：

equal
fixed
percentage


share_amount：

这个人最终应该承担多少钱。


paid_amount：

这个人已经实际支付了多少钱。


balance_amount：

share_amount - paid_amount


必须支持：

4 人平分
指定金额
百分比分摊。


例：

总金额 RM120

John RM40
Mary RM40
Peter RM40


--------------------------------------
TABLE 7: settlements
--------------------------------------

用于还款 / 结算。

字段：

id

owner_user_id

from_person_id

to_person_id

amount

currency

settlement_date

payment_method

note

created_at

updated_at


例如：

John
→
Lebin

RM50


必须支持：

部分还款。


--------------------------------------
TABLE 8: attachments
--------------------------------------

用于账单 / 收据 / 图片 / PDF。

字段：

id

owner_user_id

expense_id

file_name

file_url

mime_type

file_size

created_at


以后可以迁移到：

Cloudflare R2。


--------------------------------------
TABLE 9: audit_logs
--------------------------------------

必须保留修改记录。

字段：

id

owner_user_id

entity_type

entity_id

action

old_data

new_data

created_at


action：

create
update
delete
settle
cancel


这个系统必须具备可追踪性。


==================================================
五、数据库关系
==================================================

users
    ↓
persons

persons
    ↓
expenses

expenses
    ↓
expense_participants

expenses
    ↓
attachments

persons
    ↓
settlements

projects
    ↓
expenses

categories
    ↓
expenses


逻辑关系：

User
 ├── Persons
 ├── Expenses
 ├── Projects
 ├── Categories
 └── Settlements


Expense
 ├── Payer
 ├── Participants
 ├── Category
 ├── Project
 └── Attachments


==================================================
六、最重要的业务逻辑
==================================================


核心公式：

Outstanding Participant Balance

balance =
share_amount - paid_amount


Expense Outstanding：

total participant balances


但是更重要的是：

Person Net Balance


必须支持：

A owes B

B owes A

最后计算 Net Balance。


例如：

John owes Lebin RM100
Lebin owes John RM40

最终：

John owes Lebin RM60


不要让 Dashboard 显示：

John +100
John -40

而应该显示：

John
+RM60

John owes you


==================================================
七、Expense 创建逻辑
==================================================

用户点击：

+ New Advance

第一阶段只要求：

Amount
Description
People


例如：

RM120
Dinner
John
Mary
Peter


选择：

Equal Split


系统自动：

RM120 / 3

John = RM40
Mary = RM40
Peter = RM40


同时：

Payer = 当前 User


如果当前 User = Lebin：

Lebin 支付 RM120。


系统形成：

Lebin → John RM40
Lebin → Mary RM40
Lebin → Peter RM40


==================================================
八、支持“别人先付款”
==================================================

例如：

John 支付 RM100

实际参与：

Lebin
John
Mary


每人应该承担：

RM33.33


系统必须能够正确计算：

John 先支付 RM100

所以：

John 不欠别人

其他人分别欠 John。


因此：

Payer 不应该被简单当成“参与者中的一个普通人”。


必须计算：

个人实际支付金额
+
个人应承担金额
+
净余额。


==================================================
九、统一 Balance Engine
==================================================

不要在不同页面分别写余额计算。

必须建立：

Balance Engine

例如：

calculateExpenseBalance()

calculatePersonBalance()

calculateProjectBalance()

calculateOutstanding()

calculateNetBalance()


所有页面都调用统一 Business Logic。


禁止：

Dashboard 自己算一次
Person Page 再算一次
Statistics 再算一次


否则以后一定会出现不同页面数字不一致。


==================================================
十、Person Balance
==================================================

每个人必须有：

Total Advanced

Total Owed

Total Received

Total Paid

Outstanding

Net Balance


例如：

John

You advanced for John:
RM300

John paid for you:
RM50

John settled:
RM100

Net:

RM150


页面必须清晰告诉用户：

John owes you RM150


而不是只显示一堆数字。


==================================================
十一、Settlement 逻辑
==================================================

用户打开：

Person → John

看到：

Outstanding
RM150


点击：

Settle


弹出：

Amount
RM150

Date
Payment Method
Note


保存之后：

Settlement record 创建。


然后 Balance Engine 重新计算。


不能直接修改原 Expense 的金额作为“还款”。

必须：

Expense 永久保持原始数据。

Settlement 是独立交易。


例如：

Original Expense:

RM150


Settlement:

RM50


Remaining:

RM100


再次：

RM50


Remaining:

RM50


再次：

RM50


Remaining:

RM0


Status：

Settled


==================================================
十二、禁止破坏历史数据
==================================================

非常重要。

一笔已经发生的 Expense：

不能通过“更新 total_amount”来模拟还钱。

不能删除已经发生的交易来模拟取消。

不能修改历史数据而没有 audit log。


数据必须保持：

原始记录
+
后续变化


这使系统具备财务记录的基本可追踪性。


==================================================
十三、Expense 编辑
==================================================

允许编辑：

description
date
category
project
note
payment_method

金额和 participants 可以修改。

但是：

如果 Expense 已经产生 Settlement：

不要允许无条件修改金额。

必须：

1. 检查 Settlement
2. 如果存在 Settlement
3. 给出警告
4. 防止造成负余额


最好提供：

“Reverse / Correct”

而不是直接破坏原始交易。


==================================================
十四、删除逻辑
==================================================

不要物理 DELETE 重要交易。

Expense：

采用 soft delete / cancelled。

例如：

status = cancelled


并写入：

audit_logs


Person：

也不要直接删除。

使用：

is_archived = 1


Category：

archive


Project：

archive


这样历史记录永远不会失效。


==================================================
十五、Data Entry 设计
==================================================

新增 Expense 必须支持：

【必填】

Amount
Description
Payer
At least 1 participant
Date


【可选】

Category
Project
Payment Method
Note
Attachment


默认：

Date = 当前日期时间

Payer = 当前 User

Currency = MYR

Split = Equal


==================================================
十六、快速新增模式
==================================================

第一版必须优化“快速记录”。

用户只需要：

Amount

Description

People

Save


例如：

100

Dinner

John
Mary


Save。


高级字段放入：

More Options


避免第一次使用就看到巨大表单。


==================================================
十七、支持三种 Split
==================================================

1. Equal

系统平均分。

2. Fixed

例如：

John 20
Mary 30
Peter 50


总和必须等于 Expense Total。

3. Percentage

例如：

John 50%
Mary 30%
Peter 20%


总和必须 = 100%。


所有输入都必须实时显示：

Remaining

如果：

Total = RM100

已分：

RM80


显示：

Remaining RM20


如果超出：

RM110

显示：

Over by RM10

禁止提交。


==================================================
十八、金额精度
==================================================

所有金额必须使用整数最小货币单位。

例如：

RM10.50

保存：

1050


显示的时候：

10.50


禁止使用：

parseFloat()

直接作为核心财务计算。


==================================================
十九、日期
==================================================

数据库保存：

ISO 8601 UTC timestamp


前端根据用户时区显示。

当前使用：

Asia/Kuala_Lumpur


UI：

19 Aug 2026
18:35


数据层：

2026-08-19T10:35:00.000Z


==================================================
二十、API
==================================================

必须建立 REST API。


Expenses：

GET /api/expenses

POST /api/expenses

GET /api/expenses/:id

PUT /api/expenses/:id

DELETE /api/expenses/:id


Persons：

GET /api/persons

POST /api/persons

GET /api/persons/:id

PUT /api/persons/:id

DELETE /api/persons/:id


Projects：

GET /api/projects

POST /api/projects

PUT /api/projects/:id

DELETE /api/projects/:id


Settlements：

GET /api/settlements

POST /api/settlements

GET /api/settlements/:id

PUT /api/settlements/:id


Dashboard：

GET /api/dashboard


Statistics：

GET /api/statistics


Balance：

GET /api/balances

GET /api/balances/:personId


Categories：

GET /api/categories

POST /api/categories

PUT /api/categories/:id

DELETE /api/categories/:id


==================================================
二十一、API 返回结构
==================================================

统一：

成功：

{
    "success": true,
    "data": ...
}


错误：

{
    "success": false,
    "error": {
        "code": "...",
        "message": "..."
    }
}


不要每个 API 使用不同格式。


==================================================
二十二、API Error Code
==================================================

至少：

AUTH_REQUIRED
FORBIDDEN
VALIDATION_ERROR
NOT_FOUND
DUPLICATE
INVALID_AMOUNT
INVALID_SPLIT
INVALID_SETTLEMENT
BALANCE_ERROR
DATABASE_ERROR
INTERNAL_ERROR


前端根据 error.code 决定 UI。


==================================================
二十三、前端状态管理
==================================================

不要让页面到处自己 fetch。

建立：

api.js

负责：

GET
POST
PUT
DELETE


state.js

保存：

currentUser
persons
expenses
projects
categories
settlements
dashboard
filters


页面通过 state 获取数据。


保存数据之后：

重新获取必要的数据

而不是整个页面 reload。


不要使用：

location.reload()


作为正常更新方式。


==================================================
二十四、Create / Read / Update / Delete
==================================================

所有主要数据都需要完整 CRUD。

Expense：

Create
Read
Update
Cancel


Person：

Create
Read
Update
Archive


Project：

Create
Read
Update
Archive


Settlement：

Create
Read


Settlement 默认不能删除。

如果发生错误：

创建 reversal / correction transaction。

这样不会破坏财务历史。


==================================================
二十五、UI 页面结构
==================================================


PAGE 1
Dashboard


必须显示：

Total Advanced
Settled
Outstanding
People Who Owe
Recent Expenses
Recent Settlements


顶部：

Current Period

例如：

August 2026


快速入口：

+ New Advance


--------------------------------------

PAGE 2
Expenses


显示：

Date
Description
Payer
Amount
Participants
Outstanding
Status


支持：

Search
Filter
Sort
Pagination


Filter：

Date
Person
Project
Category
Status
Amount


--------------------------------------

PAGE 3
Expense Detail


显示：

Description

RM120

Date

Paid by:
Lebin


Participants：

John
RM40
Outstanding

Mary
RM40
Settled

Peter
RM40
Outstanding


Attachments

Notes


Actions：

Edit
Settle
Cancel


--------------------------------------

PAGE 4
People


显示：

John
RM120


Mary
RM80


Peter
RM50


按照：

Outstanding DESC


--------------------------------------

PAGE 5
Person Detail


显示：

John

Net Balance:
+RM120


Summary：

Owes you
RM150

You owe John
RM30

Net
RM120


Transaction history。


--------------------------------------

PAGE 6
Projects


显示：

Travel
RM1,200

Badminton
RM400

Dinner
RM300


进入 Project：

Total
Advanced
Outstanding
People
Expenses


--------------------------------------

PAGE 7
Settlements


显示：

Date
From
To
Amount
Method
Note


--------------------------------------

PAGE 8
Statistics


显示：

Monthly Advanced

Monthly Settled

Outstanding Trend

Category Breakdown

People Breakdown

Project Breakdown


不要一开始做复杂 BI。


==================================================
二十六、Dashboard 数据计算
==================================================

Dashboard：

Total Advanced

= 当前用户作为 payer 的 Expense total


Total Settled

= 与当前用户有关的 Settlement


Outstanding

= Balance Engine


Do not simply:

Total Advanced - Total Settled

因为可能存在：

别人替你付款
你替别人付款
双向债务。


必须使用统一 Balance Engine。


==================================================
二十七、搜索系统
==================================================

支持：

description
person name
project
category
amount


例如：

Search:

John


返回：

所有与 John 相关的交易。


==================================================
二十八、筛选系统
==================================================

支持：

Date Range

Person

Category

Project

Status

Payer

Currency


并且筛选条件可以组合。


例如：

Person = John

Status = Unsettled

Date = August


返回：

John 在 8 月仍未结算的所有金额。


==================================================
二十九、排序
==================================================

Expenses：

Newest
Oldest
Highest Amount
Lowest Amount


People：

Highest Outstanding
Lowest Outstanding
Name


Projects：

Highest Amount
Newest


==================================================
三十、分页
==================================================

不要一次从数据库加载所有历史记录。

Expenses 必须支持：

limit
offset

或：

cursor pagination


默认：

20 / page


==================================================
三十一、数据库 Index
==================================================

至少建立：

expenses(owner_user_id)

expenses(transaction_date)

expenses(payer_person_id)

expenses(project_id)

expenses(category_id)

expense_participants(expense_id)

expense_participants(person_id)

settlements(owner_user_id)

settlements(from_person_id)

settlements(to_person_id)

persons(owner_user_id)


复合 Index：

expenses(owner_user_id, transaction_date)

expense_participants(person_id, expense_id)


==================================================
三十二、数据隔离
==================================================

非常重要。

每一次数据库查询必须带：

owner_user_id


不能：

SELECT * FROM expenses


必须：

SELECT *
FROM expenses
WHERE owner_user_id = ?


防止用户看到其他人的数据。


==================================================
三十三、Authentication
==================================================

所有 API 除公开接口以外：

必须验证当前 User。


API 从 authenticated session / token 得到：

currentUserId


禁止前端：

POST owner_user_id


然后后端相信这个值。


后端永远从认证身份获取 owner_user_id。


==================================================
三十四、Authorization
==================================================

User：

只能操作自己的：

Persons
Expenses
Projects
Categories
Settlements


Admin：

可以进入 Admin Panel。

但 Admin 在这个 Sub-App 中仍然作为普通 User 使用自己的数据。


==================================================
三十五、前端 UX
==================================================

设计方向：

Premium Minimal

Minimal
Modern
Clean
Professional

不要：

大量渐变
大面积阴影
过多圆角
卡片堆叠
花哨动画
彩色 Dashboard
传统 ERP 风格


应该：

留白
清晰排版
微妙边框
低对比度背景
精确间距
高质量 Typography


整个 Toolbox 必须保持统一 Design System。


==================================================
三十六、UI Design System
==================================================

定义 CSS Variables。

例如：

--bg
--surface
--surface-hover
--border
--text-primary
--text-secondary
--text-muted
--accent
--success
--warning
--danger
--radius-sm
--radius-md
--radius-lg
--spacing-xs
--spacing-sm
--spacing-md
--spacing-lg
--spacing-xl


不要每个页面写不同颜色。

所有页面统一使用 Design Tokens。


==================================================
三十七、响应式
==================================================

Desktop First

同时支持：

Desktop
Tablet
Mobile


桌面：

Sidebar
Main Content


Mobile：

Bottom Navigation
或 Compact Header


Expense Detail 必须在手机上也易于查看。


==================================================
三十八、Loading 状态
==================================================

每个 async operation 都必须有：

Loading

不能：

点击 Save
然后页面毫无反馈。


Button：

Saving...


列表：

Skeleton / Loading indicator


==================================================
三十九、Empty State
==================================================

如果没有 Expense：

不要：

“No data”


应该：

No advances yet.

Start tracking your first advance.


并提供：

+ New Advance


==================================================
四十、Error State
==================================================

API 出错：

显示：

Unable to load data.

Retry


Save 出错：

显示：

Unable to save this advance.


不要直接：

console.error


然后什么都不告诉用户。


==================================================
四十一、Toast
==================================================

成功：

Advance saved


Settlement recorded


更新：

Expense updated


失败：

Unable to save


Toast 必须统一组件。


==================================================
四十二、Confirm Dialog
==================================================

取消 Expense：

必须确认。


例如：

Cancel this advance?

This action will keep the transaction in your history as cancelled.


不要直接删除。


==================================================
四十三、Optimistic Update
==================================================

第一阶段：

不要为了性能过早做 optimistic update。


优先：

API success
↓
Update state
↓
Update UI


确保数据正确以后再优化。


==================================================
四十四、Concurrency
==================================================

同一数据同时更新时：

后端必须重新验证。


例如：

两次 settlement 同时提交。


不能出现：

Outstanding = -RM50


提交 Settlement 前：

重新查询 Balance。


如果：

settlement > outstanding


拒绝。


==================================================
四十五、事务
==================================================

创建 Expense：

必须使用 Database Transaction。


步骤：

Create expense

Create participants

Create attachments

Create audit log


任何一步失败：

全部 rollback。


Settlement 同理：

Create settlement

Update / calculate related state

Create audit log


必须保持一致性。


==================================================
四十六、不要存储可推导数据
==================================================

以下数据原则上不要当成唯一真相长期存储：

balance_amount
outstanding
person_total


这些可以由：

Expenses
Participants
Settlements


计算得到。


如果为了性能做 cache：

必须明确：

Source of Truth = Transaction Tables


不能让：

balance column

成为错误数据的来源。


==================================================
四十七、Source of Truth
==================================================

Source of Truth：

expenses
expense_participants
settlements


Dashboard：

derived data


Statistics：

derived data


Person Balance：

derived data


UI：

derived state


绝对不要：

“前端算完直接存数据库作为真实余额”。


==================================================
四十八、数据导入
==================================================

以后需要支持：

CSV Import


CSV 至少支持：

date
description
amount
payer
participants
category
project
note


但是第一阶段可以暂时不实现 UI。

数据库架构必须允许以后扩展。


==================================================
四十九、数据导出
==================================================

以后支持：

CSV

JSON


导出包括：

Expenses
Participants
Settlements


最好支持：

Export All Data


==================================================
五十、Backup
==================================================

以后支持：

Full Backup

格式：

JSON


必须可以：

Export
Import


目标：

用户换数据库时仍然可以恢复数据。


==================================================
五十一、Audit
==================================================

所有重要 mutation：

Create Expense
Update Expense
Cancel Expense
Create Settlement
Update Person
Archive Person


必须写 Audit Log。


old_data / new_data：

可以保存 JSON。


==================================================
五十二、金额显示
==================================================

MYR：

RM 120.00


金额必须统一 formatter。


不要页面 A：

RM120


页面 B：

120.00


页面 C：

MYR 120


必须统一。


==================================================
五十三、日期显示
==================================================

统一：

19 Aug 2026


详细页面：

19 Aug 2026, 18:30


数据库：

ISO UTC


==================================================
五十四、Dashboard 交互
==================================================

Outstanding 数字可以点击。

点击：

RM460


跳到：

Expenses / People

并自动设置：

Status = Unsettled


点击：

John RM120


直接：

Person Detail → John


==================================================
五十五、Notification
==================================================

第一阶段不需要推送通知。

但数据库设计应该允许以后加入：

Reminder

例如：

John owes RM120


Reminder date：

25 Aug


未来可以实现。


==================================================
五十六、未来扩展
==================================================

架构必须允许：

Recurring expense
Debt reminder
Multi-currency
Currency conversion
Bank import
Receipt OCR
Cloudflare R2
CSV import/export
JSON backup
Scheduled reminders
Reports
PDF export


但：

现在不要为了未来功能把 MVP 搞复杂。


==================================================
五十七、MVP
==================================================

第一阶段必须完成：

Database

Authentication integration

Persons

Expenses

Participants

Equal split

Fixed split

Percentage split

Balance Engine

Dashboard

Expense Detail

Person Detail

Settlements

Partial Settlement

Search

Filter

CRUD

Audit Logs

Responsive UI


==================================================
五十八、Phase 2
==================================================

完成：

Projects

Categories

Attachments

Statistics

Charts

CSV Export

JSON Backup


==================================================
五十九、Phase 3
==================================================

未来：

Reminders

OCR

Recurring

Import

Advanced analytics

Multi-currency

Debt optimization


==================================================
六十、开发规范
==================================================

不要一次生成一个巨大 HTML。

必须模块化。


不要：

10000 行 script.js


应该：

多个 JS modules。


CSS 也模块化：

variables
base
layout
components
pages
responsive


HTML：

layout
components
page containers


==================================================
六十一、不要硬编码
==================================================

不要硬编码：

User ID
Person ID
Category ID
Project ID
Balance
Total
Currency
Date


所有数据从：

API
State
Database


获取。


==================================================
六十二、表单验证
==================================================

前端验证：

Amount > 0

Description required

Participants >= 1

Fixed split total = Expense total

Percentage total = 100

Settlement amount > 0

Settlement amount <= outstanding

Date valid


但：

前端验证只是 UX。

后端必须再次验证全部规则。


==================================================
六十三、安全
==================================================

必须：

Parameterized SQL

Input validation

Output escaping

Authorization

Authentication

CORS policy

CSRF strategy（如适用）

Rate limiting（API 层以后加入）

不要：

SQL string concatenation


==================================================
六十四、API 不允许直接暴露数据库错误
==================================================

数据库错误：

不能直接返回：

SQLite error stack


前端只收到：

DATABASE_ERROR


详细信息仅写：

server logs


==================================================
六十五、开发前必须做的事情
==================================================

在开始写代码以前：

第一：

检查现有项目结构。

第二：

检查现有：

HTML
CSS
JS
Cloudflare Worker
D1 / SQLite schema
Authentication
Routing


第三：

不要破坏已有 Sub-App。

这个 Sub-App 必须作为独立模块加入 Toolbox。


第四：

分析现有 Design System。

如果已有：

CSS variables
buttons
modal
sidebar
toast


优先复用。

不要重新造一套。


==================================================
六十六、必须先输出开发计划
==================================================

在真正修改代码以前，请先给我：

1. 当前项目结构分析
2. 建议的新目录结构
3. Database ERD
4. 完整 SQL schema
5. API endpoint list
6. Business logic
7. Balance calculation algorithm
8. Page structure
9. Component structure
10. Frontend state structure
11. Security considerations
12. Implementation order
13. Migration strategy
14. Test cases


然后再开始实现。


==================================================
六十七、数据库 Migration
==================================================

不要直接覆盖现有数据库。


如果数据库已经存在：

建立 migration：

001_create_persons.sql
002_create_categories.sql
003_create_projects.sql
004_create_expenses.sql
005_create_expense_participants.sql
006_create_settlements.sql
007_create_attachments.sql
008_create_audit_logs.sql


以后：

009_xxx.sql


不要修改已经执行过的 migration。


==================================================
六十八、Test
==================================================

至少测试以下情况：


TEST 1

Lebin 支付 RM120

John / Mary / Peter 平分。

结果：

John owes RM40
Mary owes RM40
Peter owes RM40


TEST 2

John 支付 RM100

Lebin / John / Mary 平分。

结果：

Lebin owes John
Mary owes John


TEST 3

RM100

John 50
Mary 30
Peter 20


TEST 4

John owes RM100

settlement RM30

remaining RM70


TEST 5

John owes RM100

settlement RM100

remaining RM0


TEST 6

John owes RM100

attempt settlement RM120

必须拒绝。


TEST 7

You owe John RM50

John owes you RM80

Net:

John owes you RM30


TEST 8

同时两个 settlement。

不能产生负余额。


TEST 9

取消 Expense。

Dashboard 不再计算该 Expense。


TEST 10

User A 不能读取 User B 的 Expense。


TEST 11

Admin：

可以正常使用普通 User 功能。

同时：

可以进入 Admin Panel。


TEST 12

Amount：

RM10.50

数据库：

1050


==================================================
六十九、特别重要：Balance Engine 设计
==================================================

先建立一个明确的数据计算规则。

不要在 UI 里面直接计算。


逻辑应该抽象成：

getExpensePosition(expense)

getPersonPosition(personId)

getPersonNetBalance(personId)

getUserOutstanding()

getProjectBalance(projectId)


算法基本原则：

Expense：

Payer contributes positive paid amount。

Participant gets assigned liability share。

Settlement：

From Person decreases their debt。

To Person increases received amount。


最终：

Net Balance = Total Amount Others Owe Me
             - Total Amount I Owe Others


根据正负：

> 0
别人净欠我


< 0
我净欠别人


= 0
Settled


==================================================
七十、最终验收标准
==================================================

只有满足以下条件才算完成：

[ ] Database schema complete
[ ] Migration complete
[ ] API complete
[ ] Authentication integrated
[ ] Authorization complete
[ ] Expense CRUD
[ ] Person CRUD
[ ] Project CRUD
[ ] Category CRUD
[ ] Participant management
[ ] Equal split
[ ] Fixed split
[ ] Percentage split
[ ] Settlement
[ ] Partial settlement
[ ] Balance Engine
[ ] Dashboard
[ ] Expense Detail
[ ] Person Detail
[ ] Search
[ ] Filter
[ ] Pagination
[ ] Audit Log
[ ] Loading states
[ ] Empty states
[ ] Error handling
[ ] Toast
[ ] Confirm dialogs
[ ] Responsive
[ ] Security validation
[ ] Transaction handling
[ ] Test cases pass


==================================================
七十一、最重要的 Agent 工作规则
==================================================

不要自作主张修改架构。

不要为了“快速完成”把所有东西塞到一个文件。

不要为了“简单”删除数据库关系。

不要把人物直接保存为字符串。

不要把 participants 保存成：

"John, Mary, Peter"

必须使用关系表。


不要把余额作为唯一 source of truth。

不要用 FLOAT 保存金额。

不要用前端计算结果作为数据库最终结果。

不要用 location.reload() 作为正常数据刷新方式。

不要通过删除交易模拟结算。

不要在已有 Settlement 的情况下无条件修改 Expense 金额。

不要绕过 API 直接连接数据库。

不要破坏 Toolbox 现有 Sub-App。

不要重新设计整个 Toolbox 的公共 UI，除非确实需要修改共享 Design System。


==================================================
七十二、实现方式
==================================================

你的工作顺序：

PHASE 0
检查现有项目。

PHASE 1
设计和 migration Database。

PHASE 2
实现 Repository / Data Access。

PHASE 3
实现 Balance Engine。

PHASE 4
实现 API。

PHASE 5
实现 Validation。

PHASE 6
实现 Frontend State。

PHASE 7
实现 Dashboard。

PHASE 8
实现 Expenses。

PHASE 9
实现 Persons。

PHASE 10
实现 Settlements。

PHASE 11
实现 Projects / Categories。

PHASE 12
Statistics。

PHASE 13
Audit / Error Handling。

PHASE 14
Responsive / UI polish。

PHASE 15
Testing。


每个阶段完成以后：

检查代码。

检查数据库。

检查 API。

运行测试。

确认没有破坏已有功能。


==================================================
七十三、最终产品定位
==================================================

这个 Sub-App 最终应该让用户感觉：

“我不需要记住谁欠我多少钱，系统会帮我自动算。”

而不是：

“这是一个复杂的财务软件。”


用户输入：

金额
事情
人物

系统负责：

分摊
关系
余额
结算
历史
统计


UI 必须极简。

内部架构必须严谨。


==================================================
七十四、最终要求
==================================================

现在不要马上开始疯狂生成 UI。

首先：

1. 检查现有项目
2. 分析现有架构
3. 分析已有数据库
4. 分析已有 Authentication
5. 分析已有 API
6. 分析已有 Design System
7. 输出完整实施方案
8. 输出 ERD
9. 输出 SQL Migration
10. 输出 API Contract
11. 输出 Balance Engine 逻辑
12. 输出文件结构

确认架构不会破坏已有系统之后，再开始逐阶段实现。


最重要：

宁可先建立正确的数据模型，也不要先做漂亮 UI。

最终目标：

建立一个可靠、可扩展、可审计、数据一致、UI 极简的“垫付 / 往来账管理系统”。