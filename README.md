# Court Ledger - 羽毛球 AA 算账与实用工具箱

Court Ledger 是一款为羽毛球活动组织者 (Host) 量身打造的智能 AA 场费与用球平摊计算工具。

## 目录与文件架构分类

项目采用了极简且清晰的拆分分类结构，方便快速检索与维护：

```text
CourtLedger/
├── index.html                   # 主应用入口 HTML
├── style.css                    # 主样式入口 (兼容引入 css/main.css)
├── app.js                       # 主脚本入口 (兼容引入 js/main.js)
├── bill_template.txt            # 导出账单文本模板
├── venues.csv                   # 场地费数据库
├── start.sh                     # 本地一键启动脚本
├── README.md                    # 项目说明文档
├── assets/                      # 静态资源 (Logo, QR, Favicon)
├── views/                       # 独立 View 视图 HTML (方便检索)
│   ├── hub.html                 # 工具箱主页 View
│   └── courtledger.html         # Court Ledger 算账 View
├── css/                         # CSS 样式分类目录
│   ├── variables.css            # 设计变量、主题颜色、动画曲线
│   ├── base.css                 # Reset、页头、背景、Drawer 抽屉与 Toast
│   ├── hub.css                  # 工具箱主页卡片样式
│   ├── courtledger.css          # Court Ledger 算账器专属样式
│   └── main.css                 # 样式总主汇 bundle (@import)
└── js/                          # JavaScript ES6 模块分类目录
    ├── main.js                  # 应用总初始化入口
    ├── core/                    # 核心框架模块
    │   ├── router.js            # 视图路由与 Hash 导航
    │   ├── theme.js             # 主题切换 (深色/浅色/系统) & 舍入设置
    │   └── drawer.js            # 底部抽屉 Picker 弹窗组件
    └── courtledger/             # Court Ledger 业务逻辑模块
        ├── state.js             # 场地价格数据库 (venues.csv) 与状态管理
        ├── calculator.js        # 算账核心计算引擎
        ├── ui.js                # 界面交互绑定与计算刷新
        ├── swipe.js             # 1:1 物理手势滑动与 DuitNow QR 切换
        ├── bill.js              # 账单格式化与一键剪贴板复制
        └── qr.js                # DuitNow QR 沉浸放大 Overlay
```

## 运行方法

在 Finder 中双击 `start.sh`，或者在终端运行以下命令：

```bash
./start.sh
```
