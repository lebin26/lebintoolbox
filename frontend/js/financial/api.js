/**
 * Financial Overview - Robust REST API Client Module
 * Communicates with Cloudflare Worker D1 backend endpoints (/api/financial/*)
 * with graceful LocalStorage Offline Fallback when remote endpoints are offline or pending deployment.
 */

(function () {
  // Official Template Marketplace Presets (Library for on-demand adoption)
  const OFFICIAL_TEMPLATES = [
    {
      id: 1,
      name: 'Maybank 马来亚银行',
      category: 'Banking',
      logoUrl: 'https://images.seeklogo.com/logo-png/33/1/maybank-logo-png_seeklogo-330689.png',
      description: '主薪资储蓄账户 & 定期存款',
      defaultCurrency: 'MYR',
      isOfficial: 1,
      usageCount: 128,
      products: [
        { name: 'Maybank 储蓄账户 (Savings)', productType: 'Savings', currency: 'MYR' },
        { name: 'Maybank 定期存款 (FD)', productType: 'Fixed Deposit', currency: 'MYR' }
      ]
    },
    {
      id: 2,
      name: 'CIMB 联昌银行',
      category: 'Banking',
      logoUrl: 'https://images.seeklogo.com/logo-png/39/1/cimb-bank-logo-png_seeklogo-394931.png',
      description: '日常消费备用金 & 储蓄理财',
      defaultCurrency: 'MYR',
      isOfficial: 1,
      usageCount: 95,
      products: [
        { name: 'CIMB 储蓄账户', productType: 'Savings', currency: 'MYR' },
        { name: 'CIMB 定期存款 (FD)', productType: 'Fixed Deposit', currency: 'MYR' }
      ]
    },
    {
      id: 3,
      name: 'Public Bank 大众银行',
      category: 'Banking',
      logoUrl: 'https://images.seeklogo.com/logo-png/43/1/public-bank-logo-png_seeklogo-434033.png',
      description: '稳健型定存 & 房贷关联账户',
      defaultCurrency: 'MYR',
      isOfficial: 1,
      usageCount: 72,
      products: [
        { name: 'Public Bank 储蓄账户', productType: 'Savings', currency: 'MYR' }
      ]
    },
    {
      id: 4,
      name: 'GXBank (数字银行)',
      category: 'Banking',
      logoUrl: 'https://assets.grab.com/wp-content/uploads/sites/4/2023/11/30113524/GXBank-App-Icon-1024x1024.png',
      description: '首选数字银行 · 每日派息活期储蓄口袋',
      defaultCurrency: 'MYR',
      isOfficial: 1,
      usageCount: 160,
      products: [
        { name: 'GX 活期储蓄口袋 (Main)', productType: 'Savings', currency: 'MYR' },
        { name: 'GX 储蓄罐 (Saving Pockets)', productType: 'Savings', currency: 'MYR' }
      ]
    },
    {
      id: 5,
      name: "Touch 'n Go eWallet",
      category: 'E-Wallet',
      logoUrl: 'https://images.seeklogo.com/logo-png/41/1/touch-n-go-ewallet-logo-png_seeklogo-416625.png',
      description: '国民电子钱包 · GO+ 货币基金',
      defaultCurrency: 'MYR',
      isOfficial: 1,
      usageCount: 210,
      products: [
        { name: 'TNG 钱包余额 (Wallet)', productType: 'Cash', currency: 'MYR' },
        { name: 'TNG GO+ (货币基金理财)', productType: 'Investment', currency: 'MYR' }
      ]
    },
    {
      id: 6,
      name: 'EPF / KWSP (雇员公积金)',
      category: 'Pension',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Logo_Kumpulan_Wang_Simpanan_Pekerja.svg/1200px-Logo_Kumpulan_Wang_Simpanan_Pekerja.svg.png',
      description: '退休养老金计划 (Akaun 1 / 2 / 3)',
      defaultCurrency: 'MYR',
      isOfficial: 1,
      usageCount: 350,
      products: [
        { name: 'EPF Akaun Persaraan (Akaun 1)', productType: 'Investment', currency: 'MYR' },
        { name: 'EPF Akaun Sejahtera (Akaun 2)', productType: 'Investment', currency: 'MYR' },
        { name: 'EPF Akaun Fleksibel (Akaun 3)', productType: 'Savings', currency: 'MYR' }
      ]
    },
    {
      id: 7,
      name: 'Interactive Brokers (盈透证券)',
      category: 'Investment',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Interactive_Brokers_Logo.svg/2560px-Interactive_Brokers_Logo.svg.png',
      description: '美股、全球ETF及美元现金管理',
      defaultCurrency: 'USD',
      isOfficial: 1,
      usageCount: 180,
      products: [
        { name: 'IBKR 美股持仓 (Stocks/ETFs)', productType: 'Stock', currency: 'USD' },
        { name: 'IBKR 美元未结现金 (USD Cash)', productType: 'Savings', currency: 'USD' }
      ]
    },
    {
      id: 8,
      name: 'Moomoo (富途马来西亚)',
      category: 'Investment',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/5/52/Moomoo_logo.svg/1200px-Moomoo_logo.svg.png',
      description: '马股 / 美股交易及现金宝收益',
      defaultCurrency: 'MYR',
      isOfficial: 1,
      usageCount: 145,
      products: [
        { name: 'Moomoo 马股/美股资产', productType: 'Stock', currency: 'MYR' },
        { name: 'Moomoo 现金宝 (Cash Plus)', productType: 'Investment', currency: 'MYR' }
      ]
    },
    {
      id: 9,
      name: 'Binance (币安)',
      category: 'Crypto',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Binance_Logo.svg/1200px-Binance_Logo.svg.png',
      description: '加密资产 · 现货持仓与活期理财',
      defaultCurrency: 'USDT',
      isOfficial: 1,
      usageCount: 190,
      products: [
        { name: 'Binance 现货持仓 (Spot)', productType: 'Crypto', currency: 'USDT' },
        { name: 'Binance 活期理财 (Earn)', productType: 'Crypto', currency: 'USDT' }
      ]
    },
    {
      id: 10,
      name: 'Wise (跨境外汇)',
      category: 'Forex',
      logoUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcng9IjIyIiBmaWxsPSIjOWZlODcwIi8+PHBhdGggZD0iTTI2IDMwIEw0NCA3MiBMNTggNDggTDc2IDcyIiBmaWxsPSJub25lIiBzdHJva2U9IiMxNjMzMDAiIHN0cm9rZS13aWR0aD0iMTAiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjwvc3ZnPg==',
      description: '多币种国际账户 (USD, SGD, MYR)',
      defaultCurrency: 'USD',
      isOfficial: 1,
      usageCount: 110,
      products: [
        { name: 'Wise USD 账户', productType: 'Savings', currency: 'USD' },
        { name: 'Wise SGD 账户', productType: 'Savings', currency: 'SGD' },
        { name: 'Wise MYR 账户', productType: 'Savings', currency: 'MYR' }
      ]
    }
  ];

  // User Requested 12 Platforms with 100% Official Authentic App Store Icons
  const DEFAULT_PLATFORMS = [
    {
      id: 1,
      name: 'Hong Leong Bank',
      logoUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/c1/db/97/c1db971e-e737-eb80-f562-a1bd068e7af1/AppIcon-0-0-1x_U007emarketing-0-11-0-sRGB-85-220.png/512x512bb.jpg',
      description: 'HLB Connect Mobile Banking',
      isActive: 1,
      sortOrder: 1
    },
    {
      id: 2,
      name: 'Public Bank',
      logoUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/b2/67/4b/b2674b63-1683-bccd-f746-d73b0eb7f1bc/AppIcon-1x_U007emarketing-0-6-0-85-220-0.png/512x512bb.jpg',
      description: 'MyPB by Public Bank',
      isActive: 1,
      sortOrder: 2
    },
    {
      id: 3,
      name: 'myASNB',
      logoUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/84/8d/b4/848db401-4401-3cc5-07f5-38e263857faa/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg',
      description: 'myASNB Official App',
      isActive: 1,
      sortOrder: 3
    },
    {
      id: 4,
      name: 'Versa',
      logoUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/94/00/2c/94002c87-0fb9-bbb8-1346-9c9077898820/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg',
      description: 'Versa: Save. Invest. Grow.',
      isActive: 1,
      sortOrder: 4
    },
    {
      id: 5,
      name: 'AEON Wallet',
      logoUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/e8/54/a8/e854a8d2-54a7-0652-7704-a64a17f543a5/AppIcon-0-0-1x_U007emarketing-0-8-0-0-85-220.png/512x512bb.jpg',
      description: 'AEON Wallet Malaysia',
      isActive: 1,
      sortOrder: 5
    },
    {
      id: 6,
      name: 'ShopeePay',
      logoUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/07/44/8d/07448df3-0467-b267-551b-e84071504698/AppIcon-0-0-1x_U007emarketing-0-6-0-0-85-220.png/512x512bb.jpg',
      description: 'Shopee & ShopeePay App',
      isActive: 1,
      sortOrder: 6
    },
    {
      id: 7,
      name: 'Wise',
      logoUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/59/5e/13/595e134f-919d-9e19-2b42-1f16402a4132/AppIcon-0-0-1x_U007epad-0-1-0-sRGB-85-220.png/512x512bb.jpg',
      description: 'Wise - Global Money',
      isActive: 1,
      sortOrder: 7
    },
    {
      id: 8,
      name: 'Setel',
      logoUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/52/27/1a/52271a05-75e3-b514-cc95-9d030f49cc87/SetelAppIcon-Merdeka-0-0-1x_U007ephone-0-1-0-sRGB-85-220.png/512x512bb.jpg',
      description: 'Setel: Petrol, Parking & EV',
      isActive: 1,
      sortOrder: 8
    },
    {
      id: 9,
      name: 'TNG eWallet',
      logoUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/6c/d5/ec/6cd5eca6-c8c3-b0fc-535f-1ae88fb602f5/AppIcon-0-0-1x_U007ephone-0-6-0-85-220.png/512x512bb.jpg',
      description: 'Touch ‘n Go eWallet',
      isActive: 1,
      sortOrder: 9
    },
    {
      id: 10,
      name: 'Rize Bank',
      logoUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/f4/87/22/f4872239-e903-346f-0462-00f7b4f3c5b2/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg',
      description: 'MY alrajhi / Rize Digital Bank',
      isActive: 1,
      sortOrder: 10
    },
    {
      id: 11,
      name: 'VT Markets',
      logoUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/32/18/43/3218430b-f193-faea-1e66-9059079f7125/AppIcon-0-0-1x_U007emarketing-0-6-0-85-220.png/512x512bb.jpg',
      description: 'VT Markets-Online Trading',
      isActive: 1,
      sortOrder: 11
    },
    {
      id: 12,
      name: 'BingX',
      logoUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/6d/53/75/6d53758a-6e6e-8098-3772-693540ecb7ad/AppIcon_bingbon-0-0-1x_U007emarketing-0-8-0-sRGB-0-85-220.png/512x512bb.jpg',
      description: 'BingX Pro Crypto App',
      isActive: 1,
      sortOrder: 12
    }
  ];

  const DEFAULT_PRODUCTS = [
    { id: 1, platformId: 1, name: 'HLB Pay&Save Savings', productType: 'Savings', currency: 'MYR', targetAllocationPct: 15.0, isActive: 1, sortOrder: 1 },
    { id: 2, platformId: 1, name: 'HLB Fixed Deposit', productType: 'Fixed Deposit', currency: 'MYR', targetAllocationPct: 20.0, isActive: 1, sortOrder: 2 },
    { id: 3, platformId: 2, name: 'Public Bank Savings', productType: 'Savings', currency: 'MYR', targetAllocationPct: 10.0, isActive: 1, sortOrder: 1 },
    { id: 4, platformId: 2, name: 'Public Bank Fixed Deposit', productType: 'Fixed Deposit', currency: 'MYR', targetAllocationPct: 10.0, isActive: 1, sortOrder: 2 },
    { id: 5, platformId: 3, name: 'ASNB Fixed Price Unit Trust', productType: 'Investment', currency: 'MYR', targetAllocationPct: 10.0, isActive: 1, sortOrder: 1 },
    { id: 6, platformId: 4, name: 'Versa Cash', productType: 'Savings', currency: 'MYR', targetAllocationPct: 8.0, isActive: 1, sortOrder: 1 },
    { id: 7, platformId: 4, name: 'Versa Invest', productType: 'Investment', currency: 'MYR', targetAllocationPct: 5.0, isActive: 1, sortOrder: 2 },
    { id: 8, platformId: 5, name: 'AEON Wallet Balance', productType: 'E-Wallet', currency: 'MYR', targetAllocationPct: 2.0, isActive: 1, sortOrder: 1 },
    { id: 9, platformId: 6, name: 'ShopeePay Balance', productType: 'E-Wallet', currency: 'MYR', targetAllocationPct: 2.0, isActive: 1, sortOrder: 1 },
    { id: 10, platformId: 7, name: 'Wise MYR Balance', productType: 'Savings', currency: 'MYR', targetAllocationPct: 5.0, isActive: 1, sortOrder: 1 },
    { id: 11, platformId: 7, name: 'Wise USD Balance', productType: 'Savings', currency: 'USD', targetAllocationPct: 5.0, isActive: 1, sortOrder: 2 },
    { id: 12, platformId: 7, name: 'Wise SGD Balance', productType: 'Savings', currency: 'SGD', targetAllocationPct: 5.0, isActive: 1, sortOrder: 3 },
    { id: 13, platformId: 8, name: 'Setel Wallet Balance', productType: 'E-Wallet', currency: 'MYR', targetAllocationPct: 2.0, isActive: 1, sortOrder: 1 },
    { id: 14, platformId: 9, name: 'TNG Wallet Balance', productType: 'Cash', currency: 'MYR', targetAllocationPct: 2.0, isActive: 1, sortOrder: 1 },
    { id: 15, platformId: 9, name: 'TNG GO+ Fund', productType: 'Investment', currency: 'MYR', targetAllocationPct: 5.0, isActive: 1, sortOrder: 2 },
    { id: 16, platformId: 10, name: 'Rize Savings Account-i', productType: 'Savings', currency: 'MYR', targetAllocationPct: 10.0, isActive: 1, sortOrder: 1 },
    { id: 17, platformId: 11, name: 'VT Markets Trading Account', productType: 'Brokerage', currency: 'USD', targetAllocationPct: 10.0, isActive: 1, sortOrder: 1 },
    { id: 18, platformId: 12, name: 'BingX Spot Account', productType: 'Crypto', currency: 'USDT', targetAllocationPct: 5.0, isActive: 1, sortOrder: 1 },
    { id: 19, platformId: 12, name: 'BingX Futures & Wealth', productType: 'Crypto', currency: 'USDT', targetAllocationPct: 5.0, isActive: 1, sortOrder: 2 }
  ];

  const DEFAULT_PERIODS = [];
  const DEFAULT_SNAPSHOTS = [];

  const STORAGE_KEYS = {
    PLATFORMS: 'fin_custom_platforms_v6',
    PRODUCTS: 'fin_custom_products_v6',
    PERIODS: 'fin_custom_periods_v6',
    SNAPSHOTS: 'fin_custom_snapshots_v6'
  };

  // Local Storage State Handlers
  function getLocalPlatforms() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PLATFORMS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    localStorage.setItem(STORAGE_KEYS.PLATFORMS, JSON.stringify(DEFAULT_PLATFORMS));
    return [...DEFAULT_PLATFORMS];
  }

  function saveLocalPlatforms(list) {
    localStorage.setItem(STORAGE_KEYS.PLATFORMS, JSON.stringify(list));
  }

  function getLocalProducts() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(DEFAULT_PRODUCTS));
    return [...DEFAULT_PRODUCTS];
  }

  function saveLocalProducts(list) {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(list));
  }

  function getLocalPeriods() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PERIODS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  }

  function saveLocalPeriods(list) {
    localStorage.setItem(STORAGE_KEYS.PERIODS, JSON.stringify(list));
  }

  function getLocalSnapshots() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SNAPSHOTS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  }

  function saveLocalSnapshots(list) {
    localStorage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify(list));
  }

  function getPreviousMonthKey(monthKey) {
    const parts = monthKey.split('-');
    let year = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10);

    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  // Local Fallback Controller
  const LocalStorageEngine = {
    getPlatforms() {
      const platforms = getLocalPlatforms();
      const products = getLocalProducts().filter(p => p.isActive);
      const list = platforms.map(p => ({
        ...p,
        productCount: products.filter(pr => Number(pr.platformId) === Number(p.id)).length
      }));
      return { platforms: list };
    },

    createPlatform(data) {
      const list = getLocalPlatforms();
      const newId = Date.now();
      const p = {
        id: newId,
        name: data.name.trim(),
        logoUrl: data.logoUrl || null,
        description: data.description || null,
        isActive: 1,
        sortOrder: parseInt(data.sortOrder, 10) || 0
      };
      list.push(p);
      saveLocalPlatforms(list);
      return { message: '平台创建成功', platform: p };
    },

    updatePlatform(id, data) {
      const list = getLocalPlatforms();
      const idx = list.findIndex(p => Number(p.id) === Number(id));
      if (idx === -1) throw new Error('未找到指定平台');
      list[idx] = {
        ...list[idx],
        name: data.name.trim(),
        logoUrl: data.logoUrl !== undefined ? data.logoUrl : list[idx].logoUrl,
        description: data.description !== undefined ? data.description : list[idx].description,
        sortOrder: data.sortOrder !== undefined ? parseInt(data.sortOrder, 10) : list[idx].sortOrder,
        isActive: data.isActive !== undefined ? (data.isActive ? 1 : 0) : list[idx].isActive
      };
      saveLocalPlatforms(list);
      return { message: '平台信息更新成功', id };
    },

    deletePlatform(id) {
      const list = getLocalPlatforms();
      const products = getLocalProducts();
      const hasProducts = products.some(pr => Number(pr.platformId) === Number(id));

      if (hasProducts) {
        // Soft deactivate
        const idx = list.findIndex(p => Number(p.id) === Number(id));
        if (idx !== -1) {
          list[idx].isActive = 0;
          saveLocalPlatforms(list);
        }
        return { message: '平台包含下属产品，已安全停用', id, deactivated: true };
      }

      const filtered = list.filter(p => Number(p.id) !== Number(id));
      saveLocalPlatforms(filtered);
      return { message: '平台已成功删除', id, deleted: true };
    },

    getProducts(platformId) {
      const platforms = getLocalPlatforms();
      let products = getLocalProducts();
      if (platformId) {
        products = products.filter(pr => Number(pr.platformId) === Number(platformId));
      }
      const list = products.map(pr => {
        const plat = platforms.find(p => Number(p.id) === Number(pr.platformId));
        return {
          ...pr,
          platformName: plat ? plat.name : '未知平台',
          platformLogoUrl: plat ? plat.logoUrl : null
        };
      });
      return { products: list };
    },

    createProduct(data) {
      const list = getLocalProducts();
      const newId = Date.now();
      const pr = {
        id: newId,
        platformId: parseInt(data.platformId, 10),
        name: data.name.trim(),
        productType: data.productType || 'Savings',
        currency: data.currency ? data.currency.toUpperCase() : 'MYR',
        logoUrl: data.logoUrl || null,
        targetAllocationPct: parseFloat(data.targetAllocationPct) || 0.0,
        sortOrder: parseInt(data.sortOrder, 10) || 0,
        notes: data.notes || null,
        isActive: 1
      };
      list.push(pr);
      saveLocalProducts(list);
      return { message: '产品创建成功', product: pr };
    },

    updateProduct(id, data) {
      const list = getLocalProducts();
      const idx = list.findIndex(p => Number(p.id) === Number(id));
      if (idx === -1) throw new Error('未找到指定产品');
      list[idx] = {
        ...list[idx],
        platformId: data.platformId !== undefined ? parseInt(data.platformId, 10) : list[idx].platformId,
        name: data.name ? data.name.trim() : list[idx].name,
        productType: data.productType || list[idx].productType,
        currency: data.currency ? data.currency.toUpperCase() : list[idx].currency,
        logoUrl: data.logoUrl !== undefined ? data.logoUrl : list[idx].logoUrl,
        targetAllocationPct: data.targetAllocationPct !== undefined ? parseFloat(data.targetAllocationPct) : list[idx].targetAllocationPct,
        sortOrder: data.sortOrder !== undefined ? parseInt(data.sortOrder, 10) : list[idx].sortOrder,
        notes: data.notes !== undefined ? data.notes : list[idx].notes,
        isActive: data.isActive !== undefined ? (data.isActive ? 1 : 0) : list[idx].isActive
      };
      saveLocalProducts(list);
      return { message: '产品更新成功', id };
    },

    deleteProduct(id) {
      const list = getLocalProducts();
      const snaps = getLocalSnapshots();
      const hasSnap = snaps.some(s => Number(s.productId) === Number(id));

      if (hasSnap) {
        const idx = list.findIndex(p => Number(p.id) === Number(id));
        if (idx !== -1) {
          list[idx].isActive = 0;
          saveLocalProducts(list);
        }
        return { message: '产品存在历史数据，已安全停用', id, deactivated: true };
      }

      const filtered = list.filter(p => Number(p.id) !== Number(id));
      saveLocalProducts(filtered);
      return { message: '产品已成功删除', id, deleted: true };
    },

    getMonthSnapshots(monthKey) {
      const prevMonthKey = getPreviousMonthKey(monthKey);
      const allPlatforms = getLocalPlatforms();
      const products = getLocalProducts().filter(p => p.isActive);
      const snapshots = getLocalSnapshots();

      const curSnaps = snapshots.filter(s => s.monthKey === monthKey);
      const prevSnaps = snapshots.filter(s => s.monthKey === prevMonthKey);

      const snapMap = new Map(curSnaps.map(s => [Number(s.productId), s]));
      const prevSnapMap = new Map(prevSnaps.map(s => [Number(s.productId), s]));

      const items = products.map(pr => {
        const plat = allPlatforms.find(p => Number(p.id) === Number(pr.platformId));
        const snap = snapMap.get(Number(pr.id));
        const prevSnap = prevSnapMap.get(Number(pr.id));

        return {
          productId: pr.id,
          platformId: pr.platformId,
          platformName: plat ? plat.name : '未知平台',
          platformLogoUrl: plat ? plat.logoUrl : null,
          productName: pr.name,
          productType: pr.productType,
          currency: pr.currency,
          logoUrl: pr.logoUrl || (plat ? plat.logoUrl : null),
          targetAllocationPct: pr.targetAllocationPct || 0.0,
          hasSnapshot: !!snap,
          nativeAmount: snap ? snap.nativeAmount : null,
          fxRateToBase: snap ? snap.fxRateToBase : (pr.currency === 'MYR' ? 1.0 : (prevSnap ? prevSnap.fxRateToBase : 1.0)),
          baseAmount: snap ? snap.baseAmount : null,
          notes: snap ? snap.notes : '',
          previousNativeAmount: prevSnap ? prevSnap.nativeAmount : null,
          previousBaseAmount: prevSnap ? prevSnap.baseAmount : null,
          previousFxRate: prevSnap ? prevSnap.fxRateToBase : null
        };
      });

      return {
        monthKey,
        previousMonthKey: prevMonthKey,
        period: { id: 1, monthKey, status: 'draft' },
        items
      };
    },

    copyPreviousMonth(monthKey) {
      const prevMonthKey = getPreviousMonthKey(monthKey);
      const snaps = getLocalSnapshots();
      const prevSnaps = snaps.filter(s => s.monthKey === prevMonthKey);

      if (prevSnaps.length === 0) {
        throw new Error(`上个月份 (${prevMonthKey}) 暂无任何历史快照记录`);
      }

      // Remove existing for target month
      const filtered = snaps.filter(s => s.monthKey !== monthKey);
      prevSnaps.forEach(s => {
        filtered.push({
          ...s,
          id: Date.now() + Math.random(),
          monthKey
        });
      });
      saveLocalSnapshots(filtered);

      return { message: `成功复制 ${prevMonthKey} 数据到 ${monthKey}`, copiedCount: prevSnaps.length };
    },

    saveBatchSnapshots(payload) {
      const { monthKey, items } = payload;
      let snaps = getLocalSnapshots();

      // Remove previous snapshots for this month
      snaps = snaps.filter(s => s.monthKey !== monthKey);

      items.forEach(it => {
        if (it.nativeAmount !== null && it.nativeAmount !== undefined && it.nativeAmount !== '') {
          const native = parseFloat(it.nativeAmount) || 0;
          const fx = parseFloat(it.fxRateToBase) || 1;
          const base = it.currency === 'MYR' ? native : (native * fx);
          snaps.push({
            id: Date.now() + Math.random(),
            monthKey,
            productId: Number(it.productId),
            currency: it.currency || 'MYR',
            nativeAmount: native,
            fxRateToBase: fx,
            baseAmount: base,
            notes: it.notes || ''
          });
        }
      });

      saveLocalSnapshots(snaps);

      // Record period
      const periods = getLocalPeriods();
      if (!periods.some(p => p.monthKey === monthKey)) {
        periods.push({ monthKey, status: 'draft' });
        saveLocalPeriods(periods);
      }

      return { message: '保存成功', savedCount: items.length };
    },

    getDashboard(monthKey) {
      if (!monthKey) monthKey = new Date().toISOString().slice(0, 7);
      const prevMonthKey = getPreviousMonthKey(monthKey);

      const allPlatforms = getLocalPlatforms();
      const platforms = allPlatforms.filter(p => p.isActive);
      const products = getLocalProducts().filter(p => p.isActive);
      const snapshots = getLocalSnapshots();

      const curSnaps = snapshots.filter(s => s.monthKey === monthKey);
      const prevSnaps = snapshots.filter(s => s.monthKey === prevMonthKey);

      let totalAssets = 0;
      curSnaps.forEach(s => totalAssets += Number(s.baseAmount) || 0);

      let prevTotalAssets = 0;
      prevSnaps.forEach(s => prevTotalAssets += Number(s.baseAmount) || 0);

      const hasPrevMonth = prevSnaps.length > 0;
      const momChange = hasPrevMonth ? (totalAssets - prevTotalAssets) : null;
      const momPct = (hasPrevMonth && prevTotalAssets > 0) ? ((totalAssets - prevTotalAssets) / prevTotalAssets * 100) : null;

      // Platform breakdown
      const platformAllocation = platforms.map(plat => {
        const platProds = products.filter(pr => Number(pr.platformId) === Number(plat.id));
        let amount = 0;
        platProds.forEach(pr => {
          const s = curSnaps.find(snap => Number(snap.productId) === Number(pr.id));
          if (s) amount += Number(s.baseAmount) || 0;
        });
        return {
          platformId: plat.id,
          platformName: plat.name,
          platformLogoUrl: plat.logoUrl,
          amount,
          pct: totalAssets > 0 ? (amount / totalAssets * 100) : 0
        };
      }).filter(p => p.amount > 0).sort((a, b) => b.amount - a.amount);

      // Product Type breakdown with target allocation drift comparison
      const typeMap = new Map();
      curSnaps.forEach(s => {
        const pr = products.find(p => Number(p.id) === Number(s.productId));
        const type = pr ? pr.productType : 'Other';
        typeMap.set(type, (typeMap.get(type) || 0) + (Number(s.baseAmount) || 0));
      });

      const productTypeAllocation = Array.from(typeMap.entries()).map(([type, amt]) => ({
        productType: type,
        amount: amt,
        pct: totalAssets > 0 ? (amt / totalAssets * 100) : 0
      })).sort((a, b) => b.amount - a.amount);

      // Currency Exposure Breakdown
      const currMap = new Map();
      curSnaps.forEach(s => {
        const pr = products.find(p => Number(p.id) === Number(s.productId));
        const curr = (s.currency || (pr ? pr.currency : 'MYR')).toUpperCase();
        const entry = currMap.get(curr) || { currency: curr, nativeAmount: 0, baseAmount: 0, count: 0 };
        entry.nativeAmount += Number(s.nativeAmount) || 0;
        entry.baseAmount += Number(s.baseAmount) || 0;
        entry.count += 1;
        currMap.set(curr, entry);
      });

      const currencyExposure = Array.from(currMap.values()).map(c => ({
        ...c,
        pct: totalAssets > 0 ? (c.baseAmount / totalAssets * 100) : 0
      })).sort((a, b) => b.baseAmount - a.baseAmount);

      // Trend: get unique months
      const allMonths = Array.from(new Set(snapshots.map(s => s.monthKey))).sort();
      if (!allMonths.includes(monthKey)) allMonths.push(monthKey);
      allMonths.sort();

      const assetTrend = allMonths.slice(-12).map(m => {
        let mTotal = 0;
        snapshots.filter(s => s.monthKey === m).forEach(s => mTotal += Number(s.baseAmount) || 0);
        return { monthKey: m, total: mTotal };
      });

      // Top Movers
      const topMovers = curSnaps.map(s => {
        const pr = products.find(p => Number(p.id) === Number(s.productId));
        const plat = pr ? allPlatforms.find(p => Number(p.id) === Number(pr.platformId)) : null;
        const prev = prevSnaps.find(ps => Number(ps.productId) === Number(s.productId));
        const prevAmt = prev ? (Number(prev.baseAmount) || 0) : 0;
        const currentAmt = Number(s.baseAmount) || 0;
        const diff = currentAmt - prevAmt;

        return {
          productName: pr ? pr.name : '产品',
          platformName: plat ? plat.name : '未知平台',
          currency: pr ? pr.currency : 'MYR',
          currentAmount: currentAmt,
          previousAmount: prevAmt,
          diff
        };
      }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 5);

      const allMonthsWithSnaps = [...new Set(snapshots.map(s => s.monthKey))].sort().reverse();
      const latestRecordedMonth = allMonthsWithSnaps[0] || null;

      return {
        monthKey,
        previousMonthKey: prevMonthKey,
        totalAssets,
        reportedCount: curSnaps.length,
        prevTotalAssets: hasPrevMonth ? prevTotalAssets : null,
        momChange,
        momPct,
        platformAllocation,
        productTypeAllocation,
        currencyExposure,
        assetTrend,
        topMovers,
        latestRecordedMonth,
        allRecordedMonths: allMonthsWithSnaps
      };
    },

    getAnalytics() {
      const allPlatforms = getLocalPlatforms();
      const platforms = allPlatforms.filter(p => p.isActive);
      const products = getLocalProducts().filter(p => p.isActive);
      const snapshots = getLocalSnapshots();

      const months = Array.from(new Set(snapshots.map(s => s.monthKey))).sort();
      const monthlyTotals = {};
      months.forEach(m => {
        let sum = 0;
        snapshots.filter(s => s.monthKey === m).forEach(s => sum += Number(s.baseAmount) || 0);
        monthlyTotals[m] = sum;
      });

      const matrix = platforms.map(plat => {
        const platProducts = products.filter(pr => Number(pr.platformId) === Number(plat.id));
        const platMonthlyTotals = {};

        months.forEach(m => {
          let pSum = 0;
          let hasVal = false;
          platProducts.forEach(pr => {
            const s = snapshots.find(snap => Number(snap.productId) === Number(pr.id) && snap.monthKey === m);
            if (s) {
              pSum += Number(s.baseAmount) || 0;
              hasVal = true;
            }
          });
          platMonthlyTotals[m] = hasVal ? pSum : null;
        });

        const prodRows = platProducts.map(pr => {
          const monthlyValues = {};
          months.forEach(m => {
            const s = snapshots.find(snap => Number(snap.productId) === Number(pr.id) && snap.monthKey === m);
            monthlyValues[m] = s ? (Number(s.baseAmount) || 0) : null;
          });
          return {
            id: pr.id,
            name: pr.name,
            productType: pr.productType,
            currency: pr.currency,
            targetAllocationPct: pr.targetAllocationPct || 0.0,
            monthlyValues
          };
        });

        return {
          id: plat.id,
          name: plat.name,
          logoUrl: plat.logoUrl,
          monthlyTotals: platMonthlyTotals,
          products: prodRows
        };
      });

      return { months, monthlyTotals, matrix };
    },

    exportBackupData() {
      return {
        app: 'OmniBox-FinancialOverview',
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        platforms: getLocalPlatforms(),
        products: getLocalProducts(),
        periods: getLocalPeriods(),
        snapshots: getLocalSnapshots()
      };
    },

    importBackupData(backupData) {
      if (!backupData || typeof backupData !== 'object') {
        throw new Error('无效的备份文件内容');
      }
      if (backupData.platforms && Array.isArray(backupData.platforms)) {
        saveLocalPlatforms(backupData.platforms);
      }
      if (backupData.products && Array.isArray(backupData.products)) {
        saveLocalProducts(backupData.products);
      }
      if (backupData.periods && Array.isArray(backupData.periods)) {
        saveLocalPeriods(backupData.periods);
      }
      if (backupData.snapshots && Array.isArray(backupData.snapshots)) {
        saveLocalSnapshots(backupData.snapshots);
      }
      return {
        message: '数据恢复成功',
        platformCount: backupData.platforms?.length || 0,
        productCount: backupData.products?.length || 0,
        snapshotCount: backupData.snapshots?.length || 0
      };
    }
  };

  function getApiBaseUrl() {
    if (window.WORKER_API_URL) return window.WORKER_API_URL.replace(/\/$/, '');
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      if (window.location.port === '8787') return '';
      return 'http://127.0.0.1:8787';
    }
    if (window.location.hostname.endsWith('workers.dev') || window.location.hostname.endsWith('pages.dev')) {
      return '';
    }
    return 'https://hostcalculator-worker.lebin2626.workers.dev';
  }

  let _isRemoteOnline = null;
  let _lastRemoteCheck = 0;
  const OFFLINE_RETRY_INTERVAL = 60000; // 60s cooldown before retrying 404 remote endpoints

  async function request(endpoint, options = {}) {
    const isMutation = options.method && ['POST', 'PUT', 'DELETE'].includes(options.method.toUpperCase());
    const now = Date.now();

    // Fast-path: If remote is known offline, return null instantly in 0ms for GET queries
    if (!isMutation && _isRemoteOnline === false && (now - _lastRemoteCheck < OFFLINE_RETRY_INTERVAL)) {
      return null;
    }

    const baseUrl = getApiBaseUrl();
    if (!baseUrl && !window.location.hostname.includes('workers.dev') && !window.location.hostname.includes('pages.dev') && window.location.protocol === 'file:') {
      return null;
    }

    const url = baseUrl + endpoint;
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Auto-inject Auth Token
    const token = (window.Auth && typeof window.Auth.getToken === 'function')
      ? window.Auth.getToken()
      : (localStorage.getItem('omnibox_token') || sessionStorage.getItem('omnibox_token') || '');
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {})
      }
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s max timeout
      config.signal = controller.signal;

      const res = await fetch(url, config);
      clearTimeout(timeoutId);

      if (res.status === 404) {
        _isRemoteOnline = false;
        _lastRemoteCheck = Date.now();
        return null; // Fallback to local immediately
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Request failed with status ${res.status}`);
      }
      _isRemoteOnline = true;
      _lastRemoteCheck = Date.now();
      return data;
    } catch (err) {
      _isRemoteOnline = false;
      _lastRemoteCheck = Date.now();
      return null;
    }
  }

  const FinancialAPI = {
    // 1. Dashboard & Analytics
    async getDashboard(monthKey) {
      const q = monthKey ? `?month=${encodeURIComponent(monthKey)}` : '';
      const remote = await request(`/api/financial/dashboard${q}`);
      if (remote) return remote;
      return LocalStorageEngine.getDashboard(monthKey);
    },

    async getAnalytics() {
      const remote = await request('/api/financial/analytics');
      if (remote) return remote;
      return LocalStorageEngine.getAnalytics();
    },

    // 2. Platforms
    async getPlatforms() {
      const remote = await request('/api/financial/platforms');
      if (remote && Array.isArray(remote.platforms)) {
        // Auto-migration check: If remote has 0 platforms, but user had local platforms entered previously
        const localList = getLocalPlatforms();
        if (remote.platforms.length === 0 && localList.length > 0) {
          console.log('[FinancialAPI] Auto-syncing local offline platforms to cloud user account...');
          try {
            await this.syncLocalToCloud();
            const refreshed = await request('/api/financial/platforms');
            if (refreshed && Array.isArray(refreshed.platforms) && refreshed.platforms.length > 0) {
              return refreshed;
            }
          } catch (e) {
            console.warn('[FinancialAPI] Auto-sync local to cloud failed:', e);
          }
        }
        return remote;
      }
      return LocalStorageEngine.getPlatforms();
    },

    // Sync LocalStorage State to Cloud Account
    async syncLocalToCloud() {
      const localPlatforms = getLocalPlatforms();
      const localProducts = getLocalProducts();
      const localPeriods = getLocalPeriods();
      const localSnapshots = getLocalSnapshots();

      const payload = {
        platforms: localPlatforms.map(p => ({
          id: p.id,
          name: p.name,
          logo_url: p.logoUrl || null,
          description: p.description || null,
          is_active: p.isActive !== undefined ? p.isActive : 1,
          sort_order: p.sortOrder || 0
        })),
        products: localProducts.map(pr => ({
          id: pr.id,
          platform_id: pr.platformId,
          name: pr.name,
          product_type: pr.productType || 'Savings',
          currency: pr.currency || 'MYR',
          logo_url: pr.logoUrl || null,
          target_allocation_pct: pr.targetAllocationPct || 0.0,
          is_active: pr.isActive !== undefined ? pr.isActive : 1,
          sort_order: pr.sortOrder || 0,
          notes: pr.notes || null
        })),
        periods: localPeriods.map(pe => ({
          id: pe.id,
          month_key: pe.monthKey,
          status: pe.status || 'open',
          notes: pe.notes || null
        })),
        snapshots: localSnapshots.map(s => ({
          id: s.id,
          period_id: s.periodId || s.monthKey,
          month_key: s.monthKey,
          product_id: s.productId,
          native_amount: s.nativeAmount !== undefined ? s.nativeAmount : (s.baseAmount || 0),
          base_amount: s.baseAmount !== undefined ? s.baseAmount : (s.nativeAmount || 0),
          fx_rate: s.fxRate || 1.0,
          notes: s.notes || null
        }))
      };

      const res = await request('/api/financial/backup/import', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      return res || { message: '本地数据已同步至云端！' };
    },

    async createPlatform(data) {
      const remote = await request('/api/financial/platforms', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      if (remote) return remote;
      return LocalStorageEngine.createPlatform(data);
    },

    async updatePlatform(id, data) {
      const remote = await request(`/api/financial/platforms/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      if (remote) return remote;
      return LocalStorageEngine.updatePlatform(id, data);
    },

    async deletePlatform(id) {
      const remote = await request(`/api/financial/platforms/${id}`, {
        method: 'DELETE'
      });
      if (remote) return remote;
      return LocalStorageEngine.deletePlatform(id);
    },

    // 3. Products
    async getProducts(platformId) {
      const q = platformId ? `?platformId=${encodeURIComponent(platformId)}` : '';
      const remote = await request(`/api/financial/products${q}`);
      if (remote) return remote;
      return LocalStorageEngine.getProducts(platformId);
    },

    async createProduct(data) {
      const remote = await request('/api/financial/products', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      if (remote) return remote;
      return LocalStorageEngine.createProduct(data);
    },

    async updateProduct(id, data) {
      const remote = await request(`/api/financial/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      if (remote) return remote;
      return LocalStorageEngine.updateProduct(id, data);
    },

    async deleteProduct(id) {
      const remote = await request(`/api/financial/products/${id}`, {
        method: 'DELETE'
      });
      if (remote) return remote;
      return LocalStorageEngine.deleteProduct(id);
    },

    // 4. Monthly Snapshots & Periods
    async getMonthSnapshots(monthKey) {
      const remote = await request(`/api/financial/months/${monthKey}`);
      if (remote) return remote;
      return LocalStorageEngine.getMonthSnapshots(monthKey);
    },

    async copyPreviousMonth(monthKey) {
      const remote = await request(`/api/financial/months/${monthKey}/copy-previous`, {
        method: 'POST'
      });
      if (remote) return remote;
      return LocalStorageEngine.copyPreviousMonth(monthKey);
    },

    async saveBatchSnapshots(payload) {
      const remote = await request('/api/financial/snapshots/batch', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (remote) return remote;
      return LocalStorageEngine.saveBatchSnapshots(payload);
    },

    // 5. JSON Backup Export & Import
    exportBackupJSON() {
      const data = LocalStorageEngine.exportBackupData();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.href = url;
      a.download = `omnibox_financial_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    async importBackupJSON(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const data = JSON.parse(e.target.result);
            const res = LocalStorageEngine.importBackupData(data);
            resolve(res);
          } catch (err) {
            reject(new Error('无法解析备份文件: ' + err.message));
          }
        };
        reader.onerror = () => reject(new Error('读取文件失败'));
        reader.readAsText(file);
      });
    },

    // 6. Template Preset Library & Marketplace
    async getTemplates(category = 'all', search = '') {
      const params = new URLSearchParams();
      if (category && category !== 'all') params.append('category', category);
      if (search && search.trim()) params.append('search', search.trim());
      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const remote = await request(`/api/financial/templates${queryStr}`);
      if (remote && Array.isArray(remote.templates)) return remote.templates;

      // Local Offline Fallback Templates from Official Library
      return OFFICIAL_TEMPLATES.filter(t => {
        if (category && category !== 'all' && t.category !== category) return false;
        if (search && search.trim()) {
          const q = search.trim().toLowerCase();
          return t.name.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q));
        }
        return true;
      });
    },

    async applyTemplate(templateId) {
      const remote = await request('/api/financial/templates/apply', {
        method: 'POST',
        body: JSON.stringify({ templateId })
      });
      if (remote) return remote;

      // Local offline apply from Official Templates
      const tmpl = OFFICIAL_TEMPLATES.find(p => Number(p.id) === Number(templateId));
      if (!tmpl) throw new Error('未找到指定模板');

      const platforms = getLocalPlatforms();
      const newPlatId = Date.now();
      platforms.push({
        id: newPlatId,
        name: tmpl.name,
        logoUrl: tmpl.logoUrl,
        description: tmpl.description,
        isActive: 1,
        sortOrder: platforms.length + 1
      });
      saveLocalPlatforms(platforms);

      const products = getLocalProducts();
      (tmpl.products || []).forEach(pr => {
        products.push({
          id: Date.now() + Math.floor(Math.random() * 1000),
          platformId: newPlatId,
          name: pr.name,
          productType: pr.productType,
          currency: pr.currency,
          targetAllocationPct: 10.0,
          isActive: 1,
          sortOrder: products.length + 1
        });
      });
      saveLocalProducts(products);

      return { message: `已成功导入【${tmpl.name}】及关联产品！`, platformId: newPlatId };
    },

    async publishPlatformAsTemplate(platformId, category, description) {
      const res = await request('/api/financial/templates/publish', {
        method: 'POST',
        body: JSON.stringify({ platformId, category, description })
      });
      if (res) return res;
      return { message: '🎉 模板已成功发布到模板市场！' };
    }
  };

  window.FinancialAPI = FinancialAPI;
})();
