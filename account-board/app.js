let dates = ['2026-08-07', '2026-08-08', '2026-08-09', '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16', '2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20'];

const createDaily = (views, posts, complete, fyp, engagement, followers) => dates.map((date, index) => ({ date, views: views[index], posts: posts[index], complete: complete[index], fyp: fyp[index], engagement: engagement[index], followers: followers[index] }));

const accountData = {
  accounts: [
    {
      id: 'playlab', handle: '@playlab.us', name: 'PlayLab US', region: 'US · Creator account', avatar: '玩',
      daily: createDaily([101000, 94000, 88000, 113000, 97000, 106000, 122000, 99000, 91000, 89000, 76000, 68000, 61000, 59000], [1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1], [.284, .291, .276, .302, .288, .294, .317, .280, .274, .262, .237, .226, .212, .198], [.722, .738, .701, .752, .724, .735, .781, .713, .698, .681, .641, .617, .592, .581], [.081, .079, .075, .086, .080, .084, .099, .076, .072, .070, .063, .058, .051, .048], [18200, 18290, 18340, 18410, 18550, 18640, 18790, 18820, 18890, 19010, 19080, 19150, 19240, 19380]),
      videos: [
        { id: 'V-0820', title: 'The 10-second desk reset', date: '08/20 10:42', views: 59000, complete: .198, fyp: .581, status: '观察', statusType: 'warn', action: '重做开头', thumb: 'A', curve: [2400, 9100, 26500, 43800, 59000] },
        { id: 'V-0819', title: 'Tiny hands-on puzzle test', date: '08/19 19:05', views: 61000, complete: .212, fyp: .592, status: '观察', statusType: 'warn', action: '检查承接', thumb: 'B', curve: [3100, 10800, 29100, 47800, 61000] },
        { id: 'V-0818', title: 'Can you solve it before me?', date: '08/18 12:18', views: 68000, complete: .226, fyp: .617, status: '观察', statusType: 'warn', action: '保留结构', thumb: 'C', curve: [4200, 12900, 33400, 52600, 68000] },
        { id: 'V-0817', title: 'A satisfying color match', date: '08/17 09:40', views: 76000, complete: .237, fyp: .641, status: '偏低', statusType: 'warn', action: '换 hook', thumb: 'D', curve: [5000, 15400, 38200, 60300, 76000] },
        { id: 'V-0813', title: 'The trick nobody spots first', date: '08/13 16:21', views: 122000, complete: .317, fyp: .781, status: '可复用', statusType: 'good', action: '提取结构', thumb: 'E', curve: [8200, 26100, 67700, 101000, 122000] }
      ]
    },
    {
      id: 'toyroom', handle: '@toyroom.daily', name: 'Toyroom Daily', region: 'US · Shop creator', avatar: '玩',
      daily: createDaily([76000, 81000, 72000, 87000, 92000, 88000, 99000, 94000, 91000, 85000, 83000, 79000, 75000, 73000], [1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1], [.271, .278, .265, .284, .291, .287, .302, .295, .288, .281, .276, .270, .264, .259], [.684, .697, .671, .712, .728, .719, .744, .736, .721, .708, .699, .684, .676, .669], [.070, .073, .067, .078, .082, .079, .088, .084, .080, .076, .074, .070, .068, .065], [12400, 12470, 12510, 12580, 12620, 12710, 12780, 12810, 12860, 12890, 12940, 12980, 12930, 13020]),
      videos: [
        { id: 'T-0820', title: 'One toy, three ways to play', date: '08/20 09:12', views: 73000, complete: .259, fyp: .669, status: '稳定', statusType: 'good', action: '继续发布', thumb: 'A', curve: [3500, 13300, 34200, 57300, 73000] },
        { id: 'T-0819', title: 'Guess the hidden mechanism', date: '08/19 14:38', views: 75000, complete: .264, fyp: .676, status: '稳定', statusType: 'good', action: '继续发布', thumb: 'B', curve: [3900, 14100, 35700, 60100, 75000] },
        { id: 'T-0817', title: 'A tiny surprise inside', date: '08/17 18:06', views: 83000, complete: .276, fyp: .699, status: '可复用', statusType: 'good', action: '提取结构', thumb: 'C', curve: [4400, 16800, 42100, 67700, 83000] },
        { id: 'T-0814', title: 'The sound makes it better', date: '08/14 11:50', views: 94000, complete: .295, fyp: .736, status: '可复用', statusType: 'good', action: '提取结构', thumb: 'D', curve: [6900, 21900, 52400, 78900, 94000] },
        { id: 'T-0813', title: 'Can you spot the difference?', date: '08/13 16:55', views: 99000, complete: .302, fyp: .744, status: '可复用', statusType: 'good', action: '提取结构', thumb: 'E', curve: [7200, 23500, 58700, 83800, 99000] }
      ]
    },
    {
      id: 'ugclab', handle: '@ugc.lab', name: 'UGC Lab', region: 'US · Testing account', avatar: 'U',
      daily: createDaily([42000, 47000, 39000, 55000, 52000, 58000, 62000, 57000, 51000, 49000, 46000, 43000, 41000, 38000], [0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0], [.224, .238, .217, .251, .246, .259, .271, .263, .249, .241, .232, .226, .218, .210], [.591, .607, .568, .634, .628, .651, .674, .661, .637, .621, .604, .589, .574, .558], [.051, .055, .048, .061, .059, .065, .071, .067, .060, .057, .054, .050, .047, .044], [8900, 8950, 8990, 9020, 9050, 9070, 9100, 9130, 9140, 9160, 9180, 9200, 9080, 9150]),
      videos: [
        { id: 'U-0819', title: 'POV: your first product test', date: '08/19 10:21', views: 41000, complete: .218, fyp: .574, status: '观察', statusType: 'warn', action: '换 hook', thumb: 'A', curve: [1800, 6800, 17700, 31300, 41000] },
        { id: 'U-0818', title: 'Three reactions in one take', date: '08/18 20:14', views: 43000, complete: .226, fyp: .589, status: '观察', statusType: 'warn', action: '检查节奏', thumb: 'B', curve: [2400, 7900, 19400, 32900, 43000] },
        { id: 'U-0817', title: 'The product passes the drop test', date: '08/17 13:02', views: 46000, complete: .232, fyp: .604, status: '观察', statusType: 'warn', action: '缩短铺垫', thumb: 'C', curve: [2600, 8900, 21700, 35900, 46000] },
        { id: 'U-0816', title: 'Would you try this setup?', date: '08/16 17:44', views: 49000, complete: .241, fyp: .621, status: '观察', statusType: 'warn', action: '强化问题', thumb: 'D', curve: [3200, 10200, 24300, 38700, 49000] },
        { id: 'U-0813', title: 'Unbox, test, decide', date: '08/13 09:18', views: 62000, complete: .271, fyp: .674, status: '可复用', statusType: 'good', action: '提取结构', thumb: 'E', curve: [5100, 14900, 35100, 52400, 62000] }
      ]
    }
  ]
};

const accountStorageKey = 'tiktok-signal-board-account-registry-v1';
const importedDataStorageKey = 'tiktok-signal-board-imported-data-v2';
const monitoredProductTopics = ['饭盒', '熨烫机', '玩具'];
const preloadedAccountHandles = ['nooruz046', 'nooruz332', 'nooruz556', 'nooruz75', 'tkusebyk74s', 'risophy_store', 'docusvect', 'docusvect_03', 'docusvect_04', 'manystars_shop', 'docusvect_05'];
const inactiveAccountHandles = new Set(['docusvect']);
const feishuAccountSnapshot = {
  nooruz046: { capturedAt: '2026-08-29T06:03:15.100Z', followers: 56, likes: 652, topic: '饭盒', videos: ['7678992903267454221', '7677523916243455263', '7676440636135918861', '7676440550232395021', '7676440497023356174', '7676440374197374221', '7676440106982460686', '7676440046030851342', '7676047273603779870', '7676047362736819486', '7676047220998671646', '7675662872726310157', '7675660311306784014', '7675660092494105870', '7675201215269063966', '7675201117655026975', '7675200994971602207', '7674939206979849503', '7674939098250972447', '7674945822731144478', '7673815019947183390', '7673814693676436767', '7673814227299192094', '7673813966358990111', '7673813830685691166', '7673813180962868511', '7673335825496624414', '7673335692835048735', '7673335512685399326'], videoViews: [0, 215, 288, 86, 28, 1, 4, 20, 7, 1, 3, 68, 23, 22, 130, 13, 5, 16, 154, 319, 37, 23, 282, 306, 295, 176, 4, 381, 299] },
  nooruz332: { status: '在线', type: '店铺渠道号 · 4', followers: 16 },
  nooruz556: { status: '在线', type: '店铺渠道号 · 4', followers: 28 },
  nooruz75: { status: '在线', type: '店铺渠道号 · 4', followers: 17 },
  tkusebyk74s: { status: '在线', type: '店铺渠道号 · 13' },
  risophy_store: { status: '在线', type: '官号 · 13' },
  docusvect: { status: '未更新', type: '店铺渠道号 · 15' },
  docusvect_03: { status: '在线', type: '店铺渠道号 · 15' },
  docusvect_04: { status: '在线', type: '店铺渠道号 · 15' },
  manystars_shop: { status: '在线', type: '官号 · 14' },
  docusvect_05: { status: '在线', type: '店铺渠道号 · 14' }
};
const publicProfileSnapshots = {
  docusvect: { capturedAt: '2026-08-24T01:55:55.513Z', followers: 1, likes: 0, topic: '未标注', videos: [], videoViews: [] },
  nooruz046: { capturedAt: '2026-08-28T04:06:49.226Z', followers: 55, likes: 652, topic: '饭盒', videos: ['7677523916243455263', '7676440636135918861', '7676440550232395021', '7676440497023356174', '7676440374197374221', '7676440106982460686', '7676440046030851342', '7676047273603779870', '7676047362736819486', '7676047220998671646', '7675662872726310157', '7675660311306784014', '7675660092494105870', '7675201215269063966', '7675201117655026975', '7675200994971602207', '7674939206979849503', '7674939098250972447', '7674945822731144478', '7673815019947183390', '7673814693676436767', '7673814227299192094', '7673813966358990111', '7673813830685691166'], videoViews: [215, 288, 86, 28, 1, 4, 20, 7, 0, 3, 68, 23, 22, 121, 13, 5, 16, 153, 315, 37, 23, 282, 306, 295] },
  nooruz332: { capturedAt: '2026-08-28T04:06:49.226Z', followers: 18, likes: 456, topic: '饭盒', videos: ['7677524127296539935', '7676441488540060958', '7676441415764725022', '7676441379890859294', '7676441274026642718', '7676441230221364510', '7676441061320920351', '7676046200767843614', '7676046103124495646', '7676045991715360030', '7675642974256057631', '7675642876402863390', '7675643086227180830', '7675263422208003341', '7675263497332100365', '7675263238098980109', '7674937891444870430', '7674937862537678111', '7674937794363460895', '7673822890629893407', '7673821848039099679', '7673821492978715935', '7673820947966643486', '7673819423735581983'], videoViews: [284, 291, 137, 324, 306, 280, 169, 96, 205, 317, 60, 98, 121, 19, 14, 240, 149, 313, 304, 342, 341, 296, 337, 397] },
  nooruz556: { capturedAt: '2026-08-28T04:06:49.226Z', followers: 32, likes: 515, topic: '饭盒', videos: ['7677528573938306335', '7676438523481738510', '7676438490703301901', '7676438338647231757', '7676438312965426445', '7676438187828333837', '7676049120628411678', '7676049106887773470', '7676048890365332767', '7675643449483267341', '7675643376523414798', '7675643210932260110', '7675263718002822430', '7675263601795534111', '7675263516487552287', '7674944368540699934', '7674944292304981279', '7674943615667391774', '7673790665414741279', '7673790203349241118', '7673790127054851358', '7673790015721262366', '7673789949388262686', '7673789890542177566'], videoViews: [48, 262, 88, 286, 427, 333, 331, 276, 135, 127, 273, 109, 19, 78, 58, 298, 390, 67, 461, 584, 227, 354, 602, 518] },
  nooruz75: { capturedAt: '2026-08-28T04:06:49.226Z', followers: 20, likes: 235, topic: '饭盒', videos: ['7677528791241051423', '7676439533121965326', '7676439399621496077', '7676439288334257421', '7676439212266212621', '7676439124957564174', '7676439068837776654', '7676048390773345566', '7676048377900977438', '7676048265246166302', '7675661314349419807', '7675659473335225630', '7675658446410140958', '7675200904177388813', '7675200806756437261', '7675200731531480333', '7674945644879973663', '7674945456987802911', '7674945420098931999', '7673796573741993229', '7673795732083690766', '7673795414599961869', '7673794846796074254', '7673796279176121614'], videoViews: [276, 282, 366, 5, 286, 279, 291, 46, 96, 29, 8, 83, 269, 20, 328, 174, 41, 368, 205, 69, 288, 267, 270, 296] },
  tkusebyk74s: { capturedAt: '2026-08-28T04:06:49.226Z', followers: 0, likes: 6, topic: '饭盒', videos: ['7677524249606737182', '7676427235552693518', '7676427188958235918', '7675662943563910430', '7675661531379453214', '7675663103937269022'], videoViews: [34, 308, 287, 32, 104, 112] },
  risophy_store: { capturedAt: '2026-08-28T04:06:49.226Z', followers: 33800, likes: 79800, topic: '饭盒', videos: ['7677528959860428062', '7676423188791758093', '7676423168411684110', '7676423057514302733', '7675669504269012254', '7675668970187361567', '7675668875647798559', '7499283599259356462', '7498904649685011754', '7497806545737223470', '7497780018102390062', '7497582764255104302', '7497258884948577582', '7497233872397045038', '7496901772645059883', '7496537630029565230', '7496324556085349678', '7496158759018908970', '7496126953058061611', '7495954021207788846', '7495771072244075818', '7495754147392851246', '7495428282947603754', '7495380668017364267'], videoViews: [15, 10, 5, 291, 64, 175, 179, 68100, 45700, 989, 12900, 2624, 452, 638, 968, 1006, 1023, 215, 1178, 896, 845, 995, 882, 187] },
  docusvect_03: { capturedAt: '2026-08-28T04:06:49.226Z', followers: 3, likes: 3, topic: '未标注', videos: ['7678626562031340813', '7678626523577896206', '7678266163314445581', '7678266141562686734', '7677890161010560269', '7677889908169608462', '7677527705344019726', '7677527734398110990'], videoViews: [11, 74, 97, 81, 33, 55, 34, 94] },
  docusvect_04: { capturedAt: '2026-08-28T04:06:49.226Z', followers: 2, likes: 5, topic: '未标注', videos: ['7678612328924957966', '7678612214055488781', '7678268199934184717', '7678268125544058125', '7677881150278356238', '7677881016328932621', '7677534931995692301', '7677531677509340429'], videoViews: [16, 88, 91, 117, 20, 90, 2, 61] },
  manystars_shop: { capturedAt: '2026-08-28T04:06:49.226Z', followers: 1338, likes: 5702, topic: '未标注', videos: ['7677880022513798414', '7677528865924746526', '7418932414254239007', '7418915180152737055', '7418903954110582047', '7418534149545299231', '7409180756079283502', '7408860256652037418', '7408766654869490987', '7408441124907420970', '7408384996047654187', '7408379397335469342', '7408077464326524203', '7408034970238749998'], videoViews: [55, 126, 12600, 1778, 1765, 16900, 1027, 726, 2970, 1918, 2132, 1305, 989, 892] },
  docusvect_05: { capturedAt: '2026-08-28T04:06:49.226Z', followers: 3, likes: 0, topic: '未标注', videos: ['7677524362685189406'], videoViews: [124] },
};
const publicVideoPostedAt = {
  "7676440636135918861": "2026-08-24T07:26:00+08:00",
  "7676440550232395021": "2026-08-24T02:25:00+08:00",
  "7676440497023356174": "2026-08-23T07:14:00+08:00",
  "7676440374197374221": "2026-08-23T02:37:00+08:00",
  "7676440106982460686": "2026-08-22T08:29:00+08:00",
  "7676440046030851342": "2026-08-22T01:30:00+08:00",
  "7676047273603779870": "2026-08-21T09:06:00+08:00",
  "7676047362736819486": "2026-08-21T02:55:00+08:00",
  "7676047220998671646": "2026-08-21T00:49:00+08:00",
  "7675662872726310157": "2026-08-20T11:23:00+08:00",
  "7675660311306784014": "2026-08-20T07:09:00+08:00",
  "7675660092494105870": "2026-08-20T03:16:00+08:00",
  "7675201215269063966": "2026-08-19T09:48:00+08:00",
  "7675201117655026975": "2026-08-19T08:06:00+08:00",
  "7675200994971602207": "2026-08-19T03:02:00+08:00",
  "7674939206979849503": "2026-08-18T07:52:00+08:00",
  "7674939098250972447": "2026-08-18T03:48:00+08:00",
  "7674945822731144478": "2026-08-18T02:36:00+08:00",
  "7673815019947183390": "2026-08-17T09:14:00+08:00",
  "7673814693676436767": "2026-08-17T05:20:00+08:00",
  "7673814227299192094": "2026-08-16T08:09:00+08:00",
  "7673813966358990111": "2026-08-16T04:11:00+08:00",
  "7673813830685691166": "2026-08-15T08:36:00+08:00",
  "7673813180962868511": "2026-08-15T03:58:00+08:00",
  "7673335825496624414": "2026-08-14T02:43:00+08:00",
  "7673335692835048735": "2026-08-13T12:51:00+08:00",
  "7673335512685399326": "2026-08-13T10:21:07+08:00",
  "7582180110971850015": "2025-12-11T07:18:00+08:00",
  "7581808031831313694": "2025-12-10T07:36:00+08:00",
  "7581303131405946142": "2025-12-09T07:34:00+08:00",
  "7581295938799422750": "2025-12-08T09:40:30+08:00",
  "7579817674390244639": "2025-12-05T08:43:00+08:00",
  "7676441488540060958": "2026-08-24T09:35:00+08:00",
  "7676441415764725022": "2026-08-24T05:49:00+08:00",
  "7676441379890859294": "2026-08-23T05:42:00+08:00",
  "7676441274026642718": "2026-08-23T00:49:00+08:00",
  "7676441230221364510": "2026-08-22T05:42:00+08:00",
  "7676441061320920351": "2026-08-22T01:48:00+08:00",
  "7676046200767843614": "2026-08-21T08:21:00+08:00",
  "7676046103124495646": "2026-08-21T03:03:00+08:00",
  "7676045991715360030": "2026-08-21T01:26:00+08:00",
  "7675642974256057631": "2026-08-20T08:37:00+08:00",
  "7675642876402863390": "2026-08-20T02:48:00+08:00",
  "7675643086227180830": "2026-08-20T00:15:00+08:00",
  "7675263422208003341": "2026-08-19T09:15:00+08:00",
  "7675263497332100365": "2026-08-19T08:20:00+08:00",
  "7675263238098980109": "2026-08-19T03:02:00+08:00",
  "7674937891444870430": "2026-08-18T08:26:00+08:00",
  "7676438523481738510": "2026-08-24T08:31:00+08:00",
  "7676438490703301901": "2026-08-24T03:50:00+08:00",
  "7676438338647231757": "2026-08-23T05:20:00+08:00",
  "7676438312965426445": "2026-08-22T10:39:00+08:00",
  "7676438187828333837": "2026-08-22T06:37:00+08:00",
  "7676049120628411678": "2026-08-21T07:57:00+08:00",
  "7676049106887773470": "2026-08-21T03:20:00+08:00",
  "7676048890365332767": "2026-08-21T00:52:00+08:00",
  "7675643449483267341": "2026-08-20T08:21:00+08:00",
  "7675643376523414798": "2026-08-20T03:06:00+08:00",
  "7675643210932260110": "2026-08-20T01:56:00+08:00",
  "7675263718002822430": "2026-08-19T08:45:00+08:00",
  "7675263601795534111": "2026-08-19T03:48:00+08:00",
  "7675263516487552287": "2026-08-19T02:32:00+08:00",
  "7674944368540699934": "2026-08-18T08:54:00+08:00",
  "7674944292304981279": "2026-08-18T04:46:00+08:00",
  "7676439533121965326": "2026-08-24T07:34:00+08:00",
  "7676439399621496077": "2026-08-24T03:46:00+08:00",
  "7676439288334257421": "2026-08-23T11:09:00+08:00",
  "7676439212266212621": "2026-08-23T05:49:00+08:00",
  "7676439124957564174": "2026-08-22T09:39:00+08:00",
  "7676439068837776654": "2026-08-22T04:33:00+08:00",
  "7676048390773345566": "2026-08-21T11:04:00+08:00",
  "7676048377900977438": "2026-08-21T08:23:00+08:00",
  "7676048265246166302": "2026-08-21T01:12:00+08:00",
  "7675661314349419807": "2026-08-20T10:36:00+08:00",
  "7675659473335225630": "2026-08-20T08:04:00+08:00",
  "7675658446410140958": "2026-08-20T02:33:00+08:00",
  "7675200904177388813": "2026-08-19T10:43:00+08:00",
  "7675200806756437261": "2026-08-19T08:38:00+08:00",
  "7675200731531480333": "2026-08-19T02:47:00+08:00",
  "7674945644879973663": "2026-08-18T11:59:00+08:00",
  "7676427235552693518": "2026-08-23T06:54:00+08:00",
  "7676427188958235918": "2026-08-22T04:47:00+08:00",
  "7675662943563910430": "2026-08-20T08:51:00+08:00",
  "7675661531379453214": "2026-08-20T02:17:00+08:00",
  "7675663103937269022": "2026-08-20T00:20:00+08:00",
  "7676423188791758093": "2026-08-24T01:39:00+08:00",
  "7676423168411684110": "2026-08-23T07:40:00+08:00",
  "7676423057514302733": "2026-08-22T05:31:00+08:00",
  "7675669504269012254": "2026-08-20T09:40:00+08:00",
  "7675668970187361567": "2026-08-20T03:33:00+08:00",
  "7675668875647798559": "2026-08-20T00:36:00+08:00",
  "7499283599259356462": "2025-05-01T09:31:06+08:00",
  "7498904649685011754": "2025-04-30T09:00:18+08:00",
  "7497806545737223470": "2025-04-27T09:59:22+08:00",
  "7497780018102390062": "2025-04-27T08:16:33+08:00",
  "7497582764255104302": "2025-04-26T19:32:06+08:00",
  "7497258884948577582": "2025-04-25T22:33:44+08:00",
  "7497233872397045038": "2025-04-25T20:56:41+08:00",
  "7496901772645059883": "2025-04-24T23:28:02+08:00",
  "7496537630029565230": "2025-04-23T23:54:59+08:00",
  "7496324556085349678": "2025-04-23T10:08:02+08:00",
  "7418932414254239007": "2024-09-26T20:47:25+08:00",
  "7418915180152737055": "2024-09-26T19:40:41+08:00",
  "7418903954110582047": "2024-09-26T18:57:03+08:00",
  "7418534149545299231": "2024-09-25T19:01:35+08:00",
  "7409180756079283502": "2024-08-31T14:05:38+08:00",
  "7408860256652037418": "2024-08-30T17:21:56+08:00",
  "7408766654869490987": "2024-08-30T11:18:34+08:00",
  "7408441124907420970": "2024-08-29T14:15:30+08:00",
  "7408384996047654187": "2024-08-29T10:37:34+08:00",
  "7408379397335469342": "2024-08-29T10:15:56+08:00",
  "7408077464326524203": "2024-08-28T14:44:16+08:00",
  "7408034970238749998": "2024-08-28T11:59:15+08:00"
}
;
const screenshotSamples = [1, 0, 2, 68, 23, 20, 25, 12, 5, 15, 98, 308].map((views, index) => ({ id: `screenshot-lunchbox-${index + 1}`, title: `饭盒截图样例 ${String(index + 1).padStart(2, '0')}`, handle: '截图样例', accountName: '用户截图 · 未归属账号', topic: '饭盒', views, date: '', source: '用户截图抄录 · 未核验', sample: true, sampleOrder: index }));
const demoMode = new URLSearchParams(window.location.search).get('demo') === '1';
let contentFocus = 'all'; let contentRange = 12; let scope = 'all'; let selectedAccountId = 'all'; let activeRange = 14; let selectedVideoId = 'V-0813'; let dataset = { accounts: mergeAccounts(demoMode ? structuredClone(accountData).accounts : [], createPreloadedAccounts(), loadRegisteredAccounts()) };

function normalizeDateKey(value) {
  const raw = String(value || '').trim();
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const short = raw.match(/^(\d{2})[/-](\d{2})/);
  return short ? `2026-${short[1]}-${short[2]}` : '';
}
function ensureTimelineDates(nextDates) {
  const merged = [...new Set([...dates, ...(nextDates || []).map(normalizeDateKey).filter(Boolean)])].sort().slice(-14);
  if (merged.join('|') === dates.join('|')) return;
  const previousDates = dates;
  dates = merged;
  dataset.accounts.forEach((account) => {
    const rowsByDate = new Map((account.daily || []).map((row, index) => [normalizeDateKey(row.date) || previousDates[index], row]));
    account.daily = dates.map((date) => rowsByDate.get(date) || { date, views: 0, posts: 0, complete: 0, fyp: 0, engagement: 0, followers: 0 });
  });
}
function readImportedData() {
  if (demoMode) return {};
  try {
    const saved = JSON.parse(localStorage.getItem(importedDataStorageKey) || '{}');
    return saved && typeof saved === 'object' ? saved : {};
  } catch { return {}; }
}
function restoreImportedData() {
  const saved = readImportedData();
  const savedDates = Object.values(saved).flatMap((record) => (record.daily || []).map((row) => row.date));
  ensureTimelineDates(savedDates);
  dataset.accounts = dataset.accounts.map((account) => {
    const imported = saved[account.id];
    if (!imported) return account;
    const rowsByDate = new Map((imported.daily || []).map((row) => [normalizeDateKey(row.date), row]));
    return { ...account, daily: dates.map((date) => rowsByDate.get(date) || { date, views: 0, posts: 0, complete: 0, fyp: 0, engagement: 0, followers: 0 }), videos: Array.isArray(imported.videos) ? imported.videos : account.videos, dataSource: imported.dataSource || '导入 CSV', importedData: true };
  });
}
function saveImportedData() {
  if (demoMode) return;
  try {
    const records = Object.fromEntries(dataset.accounts.filter((account) => account.importedData || account.dataSource === '导入 CSV').map((account) => [account.id, { daily: account.daily, videos: account.videos, dataSource: account.dataSource }]));
    localStorage.setItem(importedDataStorageKey, JSON.stringify(records));
  } catch { /* localStorage 不可用时仍保留当前页面内的导入结果 */ }
}
restoreImportedData();
const $ = (selector) => document.querySelector(selector);
const formatNumber = (value) => { const amount = Number(value); if (!Number.isFinite(amount)) return '—'; if (amount < 1000) return `${Math.round(amount)}`; return amount >= 1000000 ? `${(amount / 1000000).toFixed(2)}M` : `${Math.round(amount / 1000)}K`; };
const formatCount = (value) => { const absolute = Math.abs(value); const sign = value < 0 ? '-' : ''; if (absolute >= 1000000) return `${sign}${(absolute / 1000000).toFixed(2)}M`; if (absolute >= 1000) return `${sign}${(absolute / 1000).toFixed(1)}K`; return `${sign}${Math.round(absolute)}`; };
const formatSignedCount = (value) => `${value > 0 ? '+' : ''}${formatCount(value)}`;
const formatMoney = (value) => { if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—'; const amount = Number(value); if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`; if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`; return `$${amount.toFixed(2)}`; };
const parseNullableNumber = (value) => { const raw = String(value ?? '').trim(); if (!raw) return null; const number = Number(raw.replace(/[$,]/g, '')); return Number.isFinite(number) && number >= 0 ? number : null; };
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const formatPercent = (value) => `${(value * 100).toFixed(1)}%`;
const formatPublishedAt = (value) => { const raw = String(value || ''); const iso = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/); if (iso) return `${iso[1]} ${iso[2]}`; const short = raw.match(/^(\d{2})\/(\d{2})\s+(\d{2}:\d{2})/); return short ? `2026-${short[1]}-${short[2]} ${short[3]}` : raw; };
const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const median = (values) => { const sorted = [...values].sort((left, right) => left - right); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; };
const registryStorageKey = 'tiktok-signal-board-link-registry-v1';
let linkRegistry = loadLinkRegistry();

function createEmptyDaily() { return dates.map((date) => ({ date, views: 0, posts: 0, complete: 0, fyp: 0, engagement: 0, followers: 0 })); }
function createPreloadedAccounts() { return preloadedAccountHandles.map((handle) => { const feishu = feishuAccountSnapshot[handle]; const publicSnapshot = publicProfileSnapshots[handle]; const dataSource = feishu && publicSnapshot ? '飞书账号表 + TikTok公开主页' : feishu ? '飞书账号表' : publicSnapshot ? 'TikTok公开主页' : '待导入'; return { id: handle.toLowerCase(), handle: `@${handle}`, name: feishu?.type || '飞书账号', region: `${feishu?.status || (inactiveAccountHandles.has(handle) ? '暂未使用' : '待导入')} · ${feishu?.type || '后台数据待导入'}`, avatar: handle.slice(0, 1).toUpperCase(), daily: createEmptyDaily(), videos: [], dataSource, isPreloaded: true, isInactive: inactiveAccountHandles.has(handle) }; }); }
function mergeAccounts(...accountGroups) { const seen = new Set(); return accountGroups.flat().filter((account) => { if (!account || seen.has(account.id)) return false; seen.add(account.id); return true; }); }
function loadRegisteredAccounts() {
  try {
    const saved = JSON.parse(localStorage.getItem(accountStorageKey) || '[]');
    if (!Array.isArray(saved)) return [];
    return saved.filter((account) => account && account.id && account.handle).map((account) => ({ id: String(account.id), handle: String(account.handle), name: String(account.name || account.handle), region: '待导入数据', avatar: String(account.avatar || account.handle.replace('@', '').slice(0, 1).toUpperCase() || '新'), daily: createEmptyDaily(), videos: [], dataSource: '待导入', isUserAdded: true }));
  } catch { return []; }
}
function saveRegisteredAccounts() { try { localStorage.setItem(accountStorageKey, JSON.stringify(dataset.accounts.filter((account) => account.isUserAdded).map(({ id, handle, name, avatar }) => ({ id, handle, name, avatar })))); } catch { /* file:// 浏览器可能禁用本地存储，当前页面仍可继续使用 */ } }

function loadLinkRegistry() {
  const fallback = Object.fromEntries(mergeAccounts(accountData.accounts, createPreloadedAccounts()).map((account) => [account.id, { homepageUrl: account.isPreloaded ? `https://www.tiktok.com/${account.handle}` : '', note: account.isPreloaded ? (publicProfileSnapshots[account.id] ? '来自飞书账号截图，已读取公开主页' : '来自飞书账号截图，待读取公开主页') : '', videos: [] }]));
  const withPublicSnapshots = (registry) => Object.entries(publicProfileSnapshots).reduce((next, [handle, snapshot]) => { const account = next[handle] || { homepageUrl: `https://www.tiktok.com/@${handle}`, note: 'TikTok公开主页快照', videos: [] }; const publicVideos = snapshot.videos.map((videoId, index) => { const publicViews = snapshot.videoViews?.[index]; return { url: `https://www.tiktok.com/@${handle}/video/${videoId}`, note: `TikTok公开主页视频 ${String(index + 1).padStart(2, '0')} · ${publicViews === undefined || publicViews === null ? '播放量待读取' : '公开可见播放量'}`, topic: snapshot.topic, postedAt: publicVideoPostedAt[videoId] || '', views: publicViews ?? null, source: 'TikTok公开主页' }; }); const preservedVideos = (account.videos || []).filter((video) => !String(video.url || '').includes(`/@${handle}/video/`)); next[handle] = { ...account, homepageUrl: account.homepageUrl || `https://www.tiktok.com/@${handle}`, followersSnapshot: snapshot.followers ?? account.followersSnapshot, followersCheckedAt: snapshot.capturedAt?.slice(0, 10) || account.followersCheckedAt || '当前快照', likesSnapshot: snapshot.likes ?? account.likesSnapshot, videos: [...preservedVideos, ...publicVideos] }; return next; }, { ...fallback, ...registry });
  try { const saved = JSON.parse(localStorage.getItem(registryStorageKey) || '{}'); return withPublicSnapshots(saved); } catch { return withPublicSnapshots({}); }
}

function saveLinkRegistry() { try { localStorage.setItem(registryStorageKey, JSON.stringify(linkRegistry)); } catch { /* file:// 浏览器可能禁用本地存储，表单仍可继续使用 */ } }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])); }
function getVideoId(url) { return String(url || '').match(/\/video\/(\d+)/)?.[1] || ''; }
function validateTikTokUrl(value, label) { let url; try { url = new URL(value); } catch { throw new Error(`${label}必须是完整 URL`); } if (url.protocol !== 'https:' || !/(^|\.)tiktok\.com$/i.test(url.hostname)) throw new Error(`${label}必须是 TikTok 官方 HTTPS 链接`); return url.href; }
function getHandleFromHomepage(homepageUrl) { const match = new URL(homepageUrl).pathname.match(/\/@([^/]+)/); if (!match) throw new Error('主页链接必须包含 /@username，才能创建账号'); return `@${decodeURIComponent(match[1])}`; }
function createRegisteredAccount(homepageUrl, note) {
  const handle = getHandleFromHomepage(homepageUrl); const existing = dataset.accounts.find((account) => account.handle.toLowerCase() === handle.toLowerCase()); if (existing) return existing;
  const baseId = handle.slice(1).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `account-${Date.now()}`; let id = baseId; let suffix = 2; while (dataset.accounts.some((account) => account.id === id)) id = `${baseId}-${suffix++}`;
  const account = { id, handle, name: note || handle, region: '待导入数据', avatar: handle.replace('@', '').slice(0, 1).toUpperCase() || '新', daily: createEmptyDaily(), videos: [], dataSource: '待导入', isUserAdded: true }; dataset.accounts.push(account); linkRegistry[id] = { homepageUrl, note: note || '', videos: [] }; saveRegisteredAccounts(); saveLinkRegistry(); return account;
}
function getAccountOptionLabel(account) { return `${account.handle}${account.isInactive ? ' · 暂未使用' : ''}`; }
function getActiveAccounts() { return dataset.accounts.filter((account) => !account.isInactive); }
function getRegisteredAccounts() { return dataset.accounts.filter((account) => linkRegistry[account.id]?.homepageUrl); }
function populateAccountSelectors() {
  const currentAccountValue = $('#account-select').value || selectedAccountId;
  const accountOptions = dataset.accounts.map((account) => `<option value="${account.id}">${escapeHtml(getAccountOptionLabel(account))}</option>`).join('');
  $('#account-select').innerHTML = `<option value="all">总面板 · ${getActiveAccounts().length} 个使用中</option>${accountOptions}`;
  $('#account-select').value = currentAccountValue === 'all' || dataset.accounts.some((account) => account.id === currentAccountValue) ? currentAccountValue : 'all';
}
function populateRegistrySelects() {
  const currentRegistryValue = $('#registry-account-select').value || dataset.accounts[0]?.id || 'new'; const currentVideoValue = $('#video-link-account-select').value || dataset.accounts[0]?.id || 'new'; const options = dataset.accounts.map((account) => `<option value="${account.id}">${escapeHtml(getAccountOptionLabel(account))} · ${escapeHtml(account.name)}</option>`).join('');
  $('#registry-account-select').innerHTML = `<option value="new">＋ 从主页链接新增监控账号</option>${options}`; $('#video-link-account-select').innerHTML = options;
  $('#registry-account-select').value = currentRegistryValue === 'new' || dataset.accounts.some((account) => account.id === currentRegistryValue) ? currentRegistryValue : dataset.accounts[0]?.id || 'new'; $('#video-link-account-select').value = dataset.accounts.some((account) => account.id === currentVideoValue) ? currentVideoValue : dataset.accounts[0]?.id || '';
  syncRegistryForm();
}
function syncRegistryForm() { const accountId = $('#registry-account-select').value || dataset.accounts[0]?.id || 'new'; if (accountId === 'new') { $('#homepage-url').value = ''; $('#account-note').value = ''; $('#account-followers').value = ''; $('#account-snapshot-at').value = ''; $('#account-note').placeholder = '例如：美国玩具主账号'; return; } const record = linkRegistry[accountId] || { homepageUrl: '', note: '', videos: [] }; $('#homepage-url').value = record.homepageUrl; $('#account-note').value = record.note; $('#account-followers').value = record.followersSnapshot ?? ''; $('#account-snapshot-at').value = record.followersCheckedAt || ''; $('#account-note').placeholder = '例如：美国玩具主账号'; }
function renderLinkRegistry() {
  const records = dataset.accounts.map((account) => ({ account, record: linkRegistry[account.id] || { homepageUrl: '', note: '', videos: [] } }));
  const populated = records.filter(({ record }) => record.homepageUrl || record.note || record.videos.length);
  $('#registry-list').innerHTML = populated.length ? populated.map(({ account, record }) => {
    const source = account.dataSource?.includes('飞书账号表') ? '飞书账号表' : record.videos.some((video) => video.source === 'TikTok公开主页') || account.dataSource?.includes('TikTok公开主页') ? 'TikTok公开主页' : record.homepageUrl ? '账号登记' : '待完善';
    const sourceClass = source === '待完善' ? 'pending' : 'registered';
    const accountStatus = account.isInactive ? '<span class="source-badge inactive">暂未使用</span>' : '';
    const followerLabel = record.followersSnapshot !== undefined && record.followersSnapshot !== null && record.followersSnapshot !== '' ? `公开粉丝 ${formatCount(Number(record.followersSnapshot) || 0)}` : '未录入公开粉丝';
    const videoCards = record.videos.map((video, index) => {
      const hasViews = video.views !== undefined && video.views !== null && video.views !== '' && Number.isFinite(Number(video.views));
      const videoId = getVideoId(video.url);
      const title = video.note || `公开视频 ${String(index + 1).padStart(2, '0')}`;
      return `<article class="registry-video-card"><div class="registry-video-card-top"><span class="registry-video-index">${String(index + 1).padStart(2, '0')}</span><span class="content-tag">${escapeHtml(video.topic || '未标注')}</span><button class="registry-remove" type="button" data-remove-video="${account.id}" data-video-index="${index}" aria-label="删除${escapeHtml(title)}">删除</button></div><b class="registry-video-card-title">${escapeHtml(title)}</b><div class="registry-video-card-meta"><span>${videoId ? `视频 ID ${escapeHtml(videoId)}` : '视频链接已登记'}</span><span class="registry-video-status ${hasViews ? 'has-data' : 'pending'}">${hasViews ? `播放 ${formatCount(Number(video.views) || 0)}` : '播放待录入'}</span></div><div class="registry-video-card-actions"><a class="registry-open-video" href="${escapeHtml(video.url)}" target="_blank" rel="noreferrer">打开视频 ↗</a><span class="registry-video-source">${escapeHtml(video.source || '账号登记')}</span></div></article>`;
    }).join('');
    return `<article class="registry-account${account.isInactive ? ' is-inactive' : ''}"><div class="registry-account-head"><div class="registry-account-identity"><span class="registry-avatar">${escapeHtml(account.avatar || account.handle.replace('@', '').slice(0, 1).toUpperCase())}</span><div><b>${escapeHtml(account.handle)} · ${escapeHtml(account.name)}</b><small><span class="source-badge ${sourceClass}">${escapeHtml(source)}</span>${accountStatus}${record.followersCheckedAt ? ` · ${escapeHtml(record.followersCheckedAt)}` : ''}</small></div></div>${record.homepageUrl ? `<a class="registry-home-link" href="${escapeHtml(record.homepageUrl)}" target="_blank" rel="noreferrer">打开主页 ↗</a>` : '<small class="registry-home-missing">尚未填写主页链接</small>'}</div><div class="registry-account-meta"><span>${escapeHtml(record.note || '无备注')}</span><span>${followerLabel}</span>${record.likesSnapshot !== undefined && record.likesSnapshot !== null && record.likesSnapshot !== '' ? `<span>公开赞 ${formatCount(Number(record.likesSnapshot) || 0)}</span>` : ''}<span>视频链接 ${record.videos.length}</span><span>已录入播放 ${record.videos.filter((video) => video.views !== undefined && video.views !== null && video.views !== '').length}</span></div>${record.videos.length ? `<div class="registry-video-section"><div class="registry-video-section-head"><b>最近公开视频</b><span>${record.videos.length} 条 · 点击卡片内链接查看</span></div><div class="registry-video-grid">${videoCards}</div></div>` : '<div class="registry-video-empty">还没有视频链接，先在上方添加。</div>'}</article>`;
  }).join('') : '<div class="registry-empty">还没有登记账号或视频链接。先在上方添加，链接会保存在本机浏览器。</div>';
  document.querySelectorAll('[data-remove-video]').forEach((button) => button.addEventListener('click', () => { const record = linkRegistry[button.dataset.removeVideo]; record.videos.splice(Number(button.dataset.videoIndex), 1); saveLinkRegistry(); renderLinkRegistry(); }));
}

function aggregateDaily(accounts) {
  return dates.map((date, index) => { const rows = accounts.map((account) => account.daily[index]); return { date, views: rows.reduce((sum, row) => sum + row.views, 0), posts: rows.reduce((sum, row) => sum + row.posts, 0), followers: rows.reduce((sum, row) => sum + (row.followers || 0), 0), complete: average(rows.map((row) => row.complete)), fyp: average(rows.map((row) => row.fyp)), engagement: average(rows.map((row) => row.engagement)) }; });
}

function getVisibleAccounts() { return scope === 'single' && selectedAccountId !== 'all' ? dataset.accounts.filter((account) => account.id === selectedAccountId) : getActiveAccounts(); }
function hasPublicFollowerSnapshot(account) { const raw = linkRegistry[account.id]?.followersSnapshot; return raw !== undefined && raw !== null && raw !== '' && Number.isFinite(Number(raw)) && Number(raw) >= 0; }
function getPublicFollowerSnapshot(account) { return hasPublicFollowerSnapshot(account) ? Number(linkRegistry[account.id].followersSnapshot) : 0; }
function getVideoSnapshotRows(video) {
  const rows = Array.isArray(video.snapshots) ? video.snapshots : [];
  const fallback = video.snapshotAt && parseNullableNumber(video.views) !== null ? [{ at: video.snapshotAt, views: video.views }] : [];
  const uniqueRows = new Map(); [...rows, ...fallback].map((row) => ({ at: row.at || row.snapshotAt || '', views: parseNullableNumber(row.views) })).filter((row) => row.at && row.views !== null).forEach((row) => uniqueRows.set(row.at, row)); return [...uniqueRows.values()].sort((left, right) => String(left.at).localeCompare(String(right.at)));
}
function normalizeRegisteredVideo(account, video, index) {
  const videoId = getVideoId(video.url) || `${account.id}-registered-${index + 1}`;
  const snapshotRows = getVideoSnapshotRows(video);
  const title = video.title || video.note || `登记视频 ${index + 1}`;
  return { ...video, id: video.id || videoId, title, topic: resolveProductTopic({ ...video, title }) || video.topic || '未标注', date: video.date || video.postedAt || '', views: parseNullableNumber(video.views), curve: Array.isArray(video.curve) && video.curve.length > 1 ? video.curve : snapshotRows.length > 1 ? snapshotRows.map((row) => row.views) : [], snapshotTimes: snapshotRows.map((row) => row.at), complete: parseNullableNumber(video.complete), fyp: parseNullableNumber(video.fyp), thumb: video.thumb || String(index + 1).padStart(2, '0'), status: video.status || '公开快照', statusType: video.statusType || 'neutral', action: video.action || '等待下一次快照', accountId: account.id, handle: account.handle, accountName: account.name, source: video.source || account.dataSource || '账号登记数据' };
}
function getRegisteredVideos(accounts) { return accounts.flatMap((account) => (linkRegistry[account.id]?.videos || []).map((video, index) => normalizeRegisteredVideo(account, video, index))); }
function normalizeMonitoredVideo(video) { const topic = resolveProductTopic(video); return topic ? { ...video, topic } : video; }
function getScopeData() { const accounts = getVisibleAccounts(); const accountVideos = accounts.flatMap((account) => account.videos.map((video) => ({ ...video, accountId: account.id, handle: account.handle, accountName: account.name, source: video.source || account.dataSource || '演示数据' }))); const registeredVideos = getRegisteredVideos(accounts); const videos = [...accountVideos, ...registeredVideos].filter((video, index, all) => all.findIndex((candidate) => candidate.id === video.id || (candidate.url && candidate.url === video.url)) === index).filter(isMonitoredProductVideo).map(normalizeMonitoredVideo); return { accounts, daily: aggregateDaily(accounts), videos }; }
function normalizeProductTopic(values) { const text = values.filter(Boolean).join(' ').toLowerCase(); if (/饭盒|午餐盒|便当盒|lunch\s*box|food\s*container/.test(text)) return '饭盒'; if (/熨烫机|挂烫机|蒸汽熨斗|熨斗|iron(?:ing)?\s*machine|garment\s*steamer|steam\s*iron/.test(text)) return '熨烫机'; if (/玩具|toy|puzzle|kids?\s*game|playset|fidget/.test(text)) return '玩具'; return ''; }
function inferContentTopic(values) { return normalizeProductTopic(values); }
function resolveProductTopic(video) { return normalizeProductTopic([video.topic, video.product, video.title, video.note, video.hook]) || (video.topic && video.topic !== '未标注' ? video.topic : ''); }
function isMonitoredProductVideo(video) { return monitoredProductTopics.includes(resolveProductTopic(video)); }
function getAvailableContentTopics() { return [...monitoredProductTopics]; }
function getMonitoredVideosForAccount(account) { return (linkRegistry[account.id]?.videos || []).filter(isMonitoredProductVideo); }
function renderContentFocusOptions() { const select = $('#content-focus-select'); if (!select) return; const topics = getAvailableContentTopics(); const current = contentFocus; select.innerHTML = `<option value="all">三类新产品</option>${topics.map((topic) => `<option value="${escapeHtml(topic)}">${escapeHtml(topic)}</option>`).join('')}`; select.value = topics.includes(current) || current === 'all' ? current : 'all'; if (select.value !== contentFocus) contentFocus = select.value; }
function getDataSourceClass(source) { if (source.includes('导入')) return 'imported'; if (source.includes('登记') || source.includes('公开') || source.includes('飞书')) return 'registered'; if (source.includes('截图')) return 'captured'; if (source.includes('待导入')) return 'pending'; return 'demo'; }
function updateDataProvenance() {
  const sources = [...new Set(getVisibleAccounts().map((account) => account.dataSource || '演示数据'))];
  const hasImported = sources.includes('导入 CSV');
  const hasFeishu = sources.some((source) => source.includes('飞书账号表'));
  const hasDemo = sources.includes('演示数据');
  const hasPending = sources.includes('待导入');
  const hasTikTok = sources.some((source) => source.includes('TikTok公开主页'));
  const label = $('#data-source-label');
  const detail = $('#data-source-detail');
  const chip = $('#data-source-chip');
  const status = $('#data-source-status');
  if (!label || !detail || !chip || !status) return;
  if (hasImported && !hasDemo && !hasPending && !hasFeishu) {
    label.textContent = '当前数据：已导入 CSV';
    detail.textContent = '这是你导入的 TikTok Studio / Seller Center 数据，看板只负责本地计算，不会把分析结果当成 TikTok 官方判定。';
    chip.textContent = '已导入';
    chip.className = 'provenance-chip imported';
    status.textContent = '已导入 CSV · 本地分析';
    return;
  }
  if (hasDemo && !hasImported && !hasPending && !hasTikTok) {
    label.textContent = '当前数据：演示数据，非实时';
    detail.textContent = '截图中的 59K、61K 等表格数值来自看板内置演示数据；它们没有从 TikTok 实时读取，不能当作真实账号数据。';
    chip.textContent = '演示数据';
    chip.className = 'provenance-chip demo';
    status.textContent = '演示数据 · 未连接 TikTok';
    return;
  }
  if (hasFeishu && hasTikTok && !hasImported && !hasDemo) {
    label.textContent = '当前数据：公开主页快照已同步';
    detail.textContent = '已同步：飞书账号状态/类型、TikTok公开主页粉丝/赞/视频链接及页面可见播放量。看板只统计饭盒、熨烫机、玩具三类已标注产品，未标注或其他内容不会进入检测。';
    chip.textContent = '公开快照';
    chip.className = 'provenance-chip registered';
    status.textContent = '公开主页数据已同步';
    return;
  }
  if (hasFeishu && !hasImported && !hasDemo) {
    label.textContent = '当前数据：飞书账号表已更新';
    detail.textContent = '当前视图保留已登记账号；账号状态、账号类型和飞书表中可见的粉丝数已更新。公开主页没有显示的指标不会补填。';
    chip.textContent = '飞书账号表';
    chip.className = 'provenance-chip registered';
    status.textContent = '飞书账号表已同步 · 后台指标待导入';
    return;
  }
  if (hasTikTok && !hasImported && !hasDemo && !hasPending && !hasFeishu) {
    label.textContent = '当前数据：公开主页已同步，后台数据未同步';
    detail.textContent = '当前只确认公开主页字段；没有读取到的指标保持空白，不会从主页快照推算。';
    chip.textContent = '部分同步';
    chip.className = 'provenance-chip partial';
    status.textContent = '公开主页已同步 · 后台指标未同步';
    return;
  }
  label.textContent = '当前数据：混合来源';
  detail.textContent = `当前视图包含${hasImported ? '已导入数据' : ''}${hasImported && (hasPending || hasTikTok) ? '、' : ''}${hasPending ? '待导入账号' : ''}${hasPending && hasTikTok ? '、' : ''}${hasTikTok ? 'TikTok公开主页' : ''}${hasDemo ? '、演示账号' : ''}；请按每条数据旁的来源标记判断，未导入后台数据前不作完整真实结论。`;
  chip.textContent = hasPending ? '需核验' : '混合来源';
  chip.className = `provenance-chip ${hasPending ? 'pending' : 'imported'}`;
  status.textContent = hasPending ? '含待导入数据 · 需核验' : '混合来源 · 本地分析';
}

function getRecentContentItems() {
  renderContentFocusOptions(); const { videos } = getScopeData(); const accountVideos = videos.filter((video) => parseNullableNumber(video.views) !== null).map((video) => ({ ...video, topic: resolveProductTopic(video), views: Number(video.views) || 0 })); const allItems = [...accountVideos]; if (demoMode && scope === 'all') allItems.push(...screenshotSamples); const uniqueItems = [...new Map(allItems.map((item) => [item.id, item])).values()]; return uniqueItems.filter((item) => monitoredProductTopics.includes(resolveProductTopic(item)) && (contentFocus === 'all' || resolveProductTopic(item) === contentFocus)).sort((left, right) => { const leftTime = left.date ? Date.parse(left.date) : 0; const rightTime = right.date ? Date.parse(right.date) : 0; if (leftTime !== rightTime) return rightTime - leftTime; return (right.sampleOrder ?? -1) - (left.sampleOrder ?? -1); }).slice(0, contentRange);
}
function formatContentTime(item) { return item.date ? formatPublishedAt(item.date) : (item.sample ? '截图样例 · 未提供发布时间' : '未提供发布时间'); }
function getScopedMonetizationVideos() { return getScopeData().videos; }
function getPublicVisibleVideoSummary() { const allVideos = getScopeData().videos.filter((video) => String(video.source || '').includes('TikTok公开主页')); const videos = allVideos.filter((video) => parseNullableNumber(video.views) !== null); const timestampCount = allVideos.filter((video) => normalizeDateKey(video.date)).length; return { videos, count: videos.length, videoCount: allVideos.length, timestampCount, totalViews: videos.reduce((sum, video) => sum + Number(video.views), 0), accountCount: new Set(allVideos.map((video) => video.accountId)).size }; }
function getPublicPublishedDailySummary() { const counts = new Map(); getPublicVisibleVideoSummary().videos.forEach((video) => { const date = normalizeDateKey(video.date); if (date) counts.set(date, (counts.get(date) || 0) + 1); }); return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, posts]) => ({ date, posts })); }
function sumKnownMetric(videos, key) { const values = videos.map((video) => parseNullableNumber(video[key])).filter((value) => value !== null); return values.length ? { value: values.reduce((sum, value) => sum + value, 0), count: values.length } : { value: null, count: 0 }; }
function getMonetizationSummary() {
  const videos = getScopedMonetizationVideos(); const views = sumKnownMetric(videos, 'views'); const clicks = sumKnownMetric(videos, 'productClicks'); const orders = sumKnownMetric(videos, 'orders'); const gmv = sumKnownMetric(videos, 'gmv'); const commission = sumKnownMetric(videos, 'commission'); const adSpend = sumKnownMetric(videos, 'adSpend'); const clickRate = views.value !== null && clicks.value !== null && views.value > 0 ? clicks.value / views.value : null; const orderRate = clicks.value !== null && orders.value !== null && clicks.value > 0 ? orders.value / clicks.value : null; const gmvPerOrder = gmv.value !== null && orders.value !== null && orders.value > 0 ? gmv.value / orders.value : null; const roas = gmv.value !== null && adSpend.value !== null && adSpend.value > 0 ? gmv.value / adSpend.value : null; return { videos, views, clicks, orders, gmv, commission, adSpend, clickRate, orderRate, gmvPerOrder, roas, hasAny: [clicks, orders, gmv, commission, adSpend].some((metric) => metric.value !== null) };
}
function renderRecentContentMonitor() {
  const items = getRecentContentItems(); const views = items.map((item) => item.views); const baseline = median(views); const averageViews = average(views); const topItem = items.reduce((top, item) => !top || item.views > top.views ? item : top, null); $('#content-monitor-count').textContent = items.length; $('#content-monitor-average').textContent = items.length ? formatCount(averageViews) : '—'; $('#content-monitor-top').textContent = topItem ? formatCount(topItem.views) : '—'; $('#content-monitor-top-meta').textContent = topItem ? `来源：${topItem.source}` : '暂无数据'; const alert = $('#content-monitor-alert'); alert.classList.remove('good', 'empty'); if (!items.length) { alert.classList.add('empty'); alert.textContent = `当前${contentFocus === 'all' ? '内容' : contentFocus}没有可分析的视频；请导入 CSV，或在上方登记视频的内容标签和当前播放量。`; $('#recent-content-list').innerHTML = '<div class="registry-empty">暂无符合条件的最近内容。</div>'; return; } if (baseline > 0 && topItem.views >= baseline * 4) { alert.textContent = `最近${contentFocus === 'all' ? '内容' : contentFocus}播放分层明显：最高 ${formatCount(topItem.views)}，当前列表中位数 ${formatCount(baseline)}；优先对比高低播放视频的开头、演示顺序和发布时间。`; } else { alert.classList.add('good'); alert.textContent = `最近${contentFocus === 'all' ? '内容' : contentFocus}平均播放 ${formatCount(averageViews)}；继续积累下一批视频，再判断哪种内容结构更稳定。`; }
  $('#recent-content-list').innerHTML = items.map((item, index) => { const isHigh = baseline > 0 && item.views >= baseline * 2; const isLow = baseline > 0 && item.views < baseline * .5; const status = isHigh ? '高于中位数' : isLow ? '低于中位数' : '中位区间'; const statusClass = isHigh ? 'high' : isLow ? 'low' : ''; const formatNote = item.format ? ` · ${item.format}` : ''; return `<div class="recent-content-row"><span class="recent-content-index">${String(index + 1).padStart(2, '0')}</span><div class="recent-content-main"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.handle)} · ${escapeHtml(formatContentTime(item))}${escapeHtml(formatNote)} · ${escapeHtml(item.source)}</small></div><span class="content-tag">${escapeHtml(item.topic || '未标注')}</span><strong class="recent-content-views">${formatCount(item.views)}</strong><span class="recent-content-status ${statusClass}">${status}</span></div>`; }).join('');
}
function renderMonetization() {
  const summary = getMonetizationSummary(); const setMetric = (id, value) => { $(id).textContent = value === null ? '—' : value; }; setMetric('#monetization-views', summary.views.value === null ? null : formatCount(summary.views.value)); setMetric('#monetization-clicks', summary.clicks.value === null ? null : formatCount(summary.clicks.value)); setMetric('#monetization-orders', summary.orders.value === null ? null : formatCount(summary.orders.value)); setMetric('#monetization-gmv', formatMoney(summary.gmv.value)); setMetric('#monetization-commission', formatMoney(summary.commission.value)); setMetric('#funnel-views', summary.views.value === null ? null : formatCount(summary.views.value)); setMetric('#funnel-clicks', summary.clicks.value === null ? null : formatCount(summary.clicks.value)); setMetric('#funnel-orders', summary.orders.value === null ? null : formatCount(summary.orders.value)); setMetric('#funnel-gmv', formatMoney(summary.gmv.value));
  $('#monetization-views-note').textContent = summary.views.count ? `${summary.views.count} 条视频有播放字段` : '等待视频数据'; $('#monetization-click-rate').textContent = summary.clickRate === null ? '点击率待导入' : `点击率 ${formatPercent(summary.clickRate)}`; $('#monetization-order-rate').textContent = summary.orderRate === null ? '下单率待导入' : `下单率 ${formatPercent(summary.orderRate)}`; $('#monetization-gmv-rate').textContent = summary.gmvPerOrder === null ? '收入待导入' : `客单价 ${formatMoney(summary.gmvPerOrder)}`; $('#monetization-roi').textContent = summary.roas === null ? 'ROAS 待导入' : `ROAS ${summary.roas.toFixed(2)}`; $('#funnel-click-rate').textContent = summary.clickRate === null ? '点击率待导入' : `点击率 ${formatPercent(summary.clickRate)}`; $('#funnel-order-rate').textContent = summary.orderRate === null ? '下单率待导入' : `下单率 ${formatPercent(summary.orderRate)}`; $('#funnel-gmv-per-order').textContent = summary.gmvPerOrder === null ? '客单价待导入' : `客单价 ${formatMoney(summary.gmvPerOrder)}`;
  const alert = $('#monetization-alert'); alert.classList.remove('good', 'warn'); if (!summary.hasAny) { alert.textContent = '目前只有播放数据，尚未有商品点击、订单或 GMV 字段；先导入视频级变现数据，再判断“有播放但不变现”。'; return; } if (summary.clickRate !== null && summary.clickRate < .02) { alert.classList.add('warn'); alert.textContent = `当前商品点击率 ${formatPercent(summary.clickRate)} 偏弱：优先检查视频里的商品露出、CTA 和商品承诺。2% 只是看板工作阈值，不是 TikTok 官方门槛。`; return; } if (summary.orderRate !== null && summary.orderRate < .03) { alert.classList.add('warn'); alert.textContent = `当前点击到下单 ${formatPercent(summary.orderRate)}：流量已经到商品页，下一步检查 Listing、价格、评价和库存承接。`; return; } alert.classList.add('good'); alert.textContent = summary.roas !== null ? `漏斗已有成交数据，当前 ROAS ${summary.roas.toFixed(2)}；优先复制高 GMV 视频的内容类型，再逐步扩大投入。` : '漏斗已有成交数据；继续补齐广告消耗或佣金字段，才能判断投入回报。';
}

function getPublicFollowerHistory(account) {
  const record = linkRegistry[account.id] || {};
  const rows = Array.isArray(record.followerSnapshots) ? record.followerSnapshots : [];
  const fallback = hasPublicFollowerSnapshot(account) ? [{ at: record.followersCheckedAt || '当前快照', value: getPublicFollowerSnapshot(account) }] : [];
  return [...rows, ...fallback].map((row) => ({ at: row.at || '', value: Number(row.value) })).filter((row) => row.at && Number.isFinite(row.value) && row.value >= 0).sort((left, right) => String(left.at).localeCompare(String(right.at))).filter((row, index, all) => index === all.findIndex((candidate) => candidate.at === row.at));
}
function calculateAnalysis() {
  const { accounts, daily } = getScopeData(); const baselineWindow = daily.slice(0, Math.max(5, Math.floor(daily.length * .65))); const recentWindow = daily.slice(-3); const baselineViews = median(baselineWindow.map((day) => day.views)); const recentViews = average(recentWindow.map((day) => day.views));
  const publicSnapshotAccounts = accounts.filter((account) => hasPublicFollowerSnapshot(account) && !(account.daily.at(-1)?.followers > 0)); const publicFollowerTotals = new Map(); publicSnapshotAccounts.forEach((account) => getPublicFollowerHistory(account).forEach((row) => publicFollowerTotals.set(row.at, (publicFollowerTotals.get(row.at) || 0) + row.value))); const publicFollowerSeries = [...publicFollowerTotals.entries()].sort((left, right) => String(left[0]).localeCompare(String(right[0]))).map(([at, value]) => ({ at, value })); const publicOnlyFollowers = publicSnapshotAccounts.reduce((sum, account) => sum + getPublicFollowerSnapshot(account), 0); const hasDailyFollowers = (daily.at(-1)?.followers || 0) > 0; const hasPublicFollowers = publicSnapshotAccounts.length > 0; const latestFollowers = hasDailyFollowers ? (daily.at(-1)?.followers || 0) + (hasPublicFollowers ? publicOnlyFollowers : 0) : publicFollowerSeries.at(-1)?.value || 0; const yesterdayFollowers = hasDailyFollowers ? (daily.at(-2)?.followers || 0) : publicFollowerSeries.at(-2)?.value || 0; const followerDelta = latestFollowers - yesterdayFollowers; const hasData = daily.some((day) => day.views > 0 || day.posts > 0 || day.followers > 0); const followerSource = hasPublicFollowers && hasDailyFollowers ? '混合来源' : hasDailyFollowers ? '导入 CSV' : hasPublicFollowers ? '公开主页快照' : '无';
  return { daily, baselineViews, recentViews, baselineComplete: average(baselineWindow.map((day) => day.complete)), recentComplete: average(recentWindow.map((day) => day.complete)), baselineFyp: average(baselineWindow.map((day) => day.fyp)), recentFyp: average(recentWindow.map((day) => day.fyp)), baselineEngagement: average(baselineWindow.map((day) => day.engagement)), recentEngagement: average(recentWindow.map((day) => day.engagement)), viewDelta: baselineViews ? (recentViews - baselineViews) / baselineViews : 0, latestFollowers, yesterdayFollowers, followerDelta, followerDeltaRate: yesterdayFollowers ? followerDelta / yesterdayFollowers : 0, followerSource, hasPublicFollowers, hasFollowerHistory: hasDailyFollowers && yesterdayFollowers > 0 || !hasDailyFollowers && publicFollowerSeries.length > 1, publicFollowerSeries, hasData };
}

function renderViewsChart() {
  const svg = $('#views-chart'); const analysis = calculateAnalysis(); const daily = analysis.daily.slice(-activeRange); const publicSummary = getPublicVisibleVideoSummary(); const hasDailyViews = daily.some((day) => day.views > 0); const width = 760; const height = 280; const pad = { top: 18, right: 14, bottom: 21, left: 12 };
  if (!hasDailyViews && publicSummary.count) {
    $('#views-chart-title').textContent = '公开视频当前播放'; $('#views-chart-legend').innerHTML = '<span><i class="legend-line actual"></i>公开可见播放</span><span class="legend-note">每柱 = 1 条视频 · 无历史曲线</span>'; $('#views-chart-foot').innerHTML = '<span>公开视频序号</span><span>当前公开快照</span>'; const values = publicSummary.videos.slice(0, 18).map((video) => Number(video.views)); const maxValue = Math.max(...values, 1); const slot = (width - pad.left - pad.right) / values.length; const barWidth = Math.min(30, slot * .58); const bars = values.map((value, index) => { const barHeight = (value / maxValue) * (height - pad.top - pad.bottom - 20); const x = pad.left + index * slot + (slot - barWidth) / 2; const y = height - pad.bottom - barHeight; return `<rect class="posts-bar active" x="${x}" y="${y}" width="${barWidth}" height="${Math.max(barHeight, 2)}" rx="3"><title>${publicSummary.videos[index].title}: ${formatCount(value)}</title></rect><text class="chart-label" x="${x + barWidth / 2}" y="${height - 4}" text-anchor="middle">${String(index + 1).padStart(2, '0')}</text>`; }).join(''); svg.innerHTML = `${bars}<text class="chart-empty" x="380" y="16" text-anchor="middle">${publicSummary.count} 条公开视频 · 合计 ${formatCount(publicSummary.totalViews)} · 非 14 天后台总播放</text>`; return;
  }
  $('#views-chart-title').textContent = '播放量与自身基线'; $('#views-chart-legend').innerHTML = '<span><i class="legend-line actual"></i>实际播放</span><span><i class="legend-line baseline"></i>自身基线</span><span class="legend-note">橙点 = 异常日</span>'; $('#views-chart-foot').innerHTML = renderDateLabels(daily); if (!hasDailyViews) { svg.innerHTML = '<text class="chart-empty" x="380" y="135" text-anchor="middle">近 14 天播放数据待导入</text>'; return; } const maxValue = Math.max(...daily.map((day) => day.views), analysis.baselineViews, 1) * 1.16;
  const x = (index) => pad.left + (index / Math.max(daily.length - 1, 1)) * (width - pad.left - pad.right); const y = (value) => height - pad.bottom - (value / maxValue) * (height - pad.top - pad.bottom); const actualPoints = daily.map((day, index) => `${x(index).toFixed(1)},${y(day.views).toFixed(1)}`).join(' '); const areaPoints = `${pad.left},${height - pad.bottom} ${actualPoints} ${x(daily.length - 1)},${height - pad.bottom}`;
  const grid = [.25, .5, .75, 1].map((ratio) => `<line class="chart-grid" x1="${pad.left}" x2="${width - pad.right}" y1="${y(maxValue * ratio)}" y2="${y(maxValue * ratio)}" />`).join(''); const labels = [0, Math.floor(daily.length / 3), Math.floor(daily.length * 2 / 3), daily.length - 1].map((index) => `<text class="chart-label" x="${x(index)}" y="${height - 3}" text-anchor="middle">${daily[index].date.slice(5).replace('-', '.')}</text>`).join(''); const dots = daily.map((day, index) => `<circle class="chart-dot ${index >= daily.length - 3 || day.views < analysis.baselineViews * .8 ? 'alert' : ''}" cx="${x(index)}" cy="${y(day.views)}" r="${index >= daily.length - 3 ? 5 : 3.5}"><title>${day.date}: ${formatNumber(day.views)}</title></circle>`).join('');
  svg.innerHTML = `<defs><linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="oklch(0.90 0.18 120)" stop-opacity=".18"/><stop offset="1" stop-color="oklch(0.90 0.18 120)" stop-opacity="0"/></linearGradient></defs>${grid}<polygon class="chart-area" points="${areaPoints}"/><line class="chart-baseline" x1="${pad.left}" x2="${width - pad.right}" y1="${y(analysis.baselineViews)}" y2="${y(analysis.baselineViews)}"/><polyline class="chart-actual" points="${actualPoints}"/>${dots}${labels}`;
}

function renderPostsChart() {
  const svg = $('#posts-chart'); const daily = calculateAnalysis().daily.slice(-activeRange); const publicSummary = getPublicVisibleVideoSummary(); const publicDaily = getPublicPublishedDailySummary().slice(-activeRange); const hasDailyPosts = daily.some((day) => day.posts > 0); const usePublicDates = !hasDailyPosts && publicDaily.length > 0; const chartDaily = usePublicDates ? publicDaily : daily;
  $('#posts-chart-title').textContent = hasDailyPosts ? '每天发布了多少条视频' : usePublicDates ? '公开视频发布时间分布' : '公开主页视频数量'; $('#posts-panel-note').textContent = hasDailyPosts ? `${scope === 'all' ? '总面板' : '单账号'} · 近 ${activeRange} 天` : usePublicDates ? `${publicSummary.videoCount} 条公开视频 · 详情页时间（北京时间）` : `${publicSummary.videoCount} 条公开视频 · 发布时间待读取`; $('#posts-chart-foot').innerHTML = hasDailyPosts || usePublicDates ? renderDateLabels(chartDaily) : '<span>公开主页视频列表</span><span>无精确发布时间</span>';
  if (!hasDailyPosts && !usePublicDates) { svg.innerHTML = publicSummary.videoCount ? `<text class="chart-empty" x="380" y="100" text-anchor="middle">已读取 ${publicSummary.videoCount} 条公开视频</text><text class="chart-empty" x="380" y="125" text-anchor="middle">精确发布时间待读取，暂不伪造每日发布曲线</text>` : '<text class="chart-empty" x="380" y="110" text-anchor="middle">近 14 天发布数量待导入</text>'; return; }
  const width = 760; const height = 220; const pad = { top: 18, right: 14, bottom: 22, left: 12 }; const maxPosts = Math.max(...chartDaily.map((day) => day.posts), 1); const slot = (width - pad.left - pad.right) / chartDaily.length; const barWidth = Math.min(24, slot * .48); const y = (value) => height - pad.bottom - (value / maxPosts) * (height - pad.top - pad.bottom);
  const bars = chartDaily.map((day, index) => { const barHeight = height - pad.bottom - y(day.posts); const left = pad.left + index * slot + (slot - barWidth) / 2; const label = usePublicDates ? `${day.posts} 条公开视频` : `${day.posts} 条`; return `<rect class="posts-bar ${index >= chartDaily.length - 3 ? 'active' : ''}" x="${left}" y="${y(day.posts)}" width="${barWidth}" height="${Math.max(barHeight, 2)}" rx="3"><title>${day.date}: ${label}</title></rect><text class="posts-label" x="${left + barWidth / 2}" y="${y(day.posts) - 7}" text-anchor="middle">${day.posts}</text>`; }).join(''); const labels = [0, Math.floor(chartDaily.length / 3), Math.floor(chartDaily.length * 2 / 3), chartDaily.length - 1].filter((index, position, all) => all.indexOf(index) === position).map((index) => `<text class="chart-label" x="${pad.left + index * slot + slot / 2}" y="${height - 3}" text-anchor="middle">${chartDaily[index].date.slice(5).replace('-', '.')}</text>`).join('');
  svg.innerHTML = `<line class="chart-grid" x1="${pad.left}" x2="${width - pad.right}" y1="${height - pad.bottom}" y2="${height - pad.bottom}"/>${bars}${labels}`;
}

function renderFollowerSparkline() {
  const svg = $('#followers-sparkline'); const analysis = calculateAnalysis(); const daily = analysis.daily.slice(-activeRange); const values = daily.some((day) => day.followers > 0) ? daily.map((day) => day.followers) : (analysis.publicFollowerSeries || []).map((row) => row.value); if (!values.length) { svg.innerHTML = ''; return; }
  const width = 180; const height = 46; const pad = 3; const minValue = Math.min(...values); const maxValue = Math.max(...values); const spread = Math.max(maxValue - minValue, 1); const x = (index) => pad + (index / Math.max(values.length - 1, 1)) * (width - pad * 2); const y = (value) => height - pad - ((value - minValue) / spread) * (height - pad * 2); const points = values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' '); const dots = values.slice(-3).map((value, offset) => { const index = values.length - Math.min(values.length, 3) + offset; return `<circle class="follower-spark-dot" cx="${x(index)}" cy="${y(value)}" r="2.5"/>`; }).join('');
  svg.innerHTML = `<polyline class="follower-spark-line" points="${points}"/>${dots}`;
}

function renderFollowerAlert() {
  const analysis = calculateAnalysis(); const alert = $('#follower-alert'); const badge = $('#metric-followers-badge'); const status = $('#metric-followers-status'); const deltaText = formatSignedCount(analysis.followerDelta); const available = analysis.hasPublicFollowers || analysis.latestFollowers > 0 || analysis.yesterdayFollowers > 0;
  alert.classList.remove('growth', 'decline', 'neutral'); badge.classList.remove('good', 'down', 'neutral');
  if (!available) {
    alert.classList.add('neutral'); badge.classList.add('neutral'); badge.textContent = '待导入'; status.textContent = '暂无粉丝历史'; $('#metric-followers').textContent = '—'; $('#metric-followers-delta').textContent = '需要粉丝字段'; $('#metric-followers-rate').textContent = '无法比较'; $('#follower-alert-headline').textContent = '还没有粉丝数量数据'; $('#follower-alert-summary').textContent = '导入包含 followers 列的每日数据后，看板会自动计算今日与昨日的增减。'; $('#follower-alert-meta').textContent = '数据要求：date · followers'; return;
  }
  if (analysis.followerSource === '混合来源') {
    alert.classList.add('neutral'); badge.classList.add('neutral'); badge.textContent = '混合来源'; status.textContent = '暂不可比'; $('#metric-followers').textContent = formatCount(analysis.latestFollowers); $('#metric-followers-delta').textContent = '昨日不可比'; $('#metric-followers-rate').textContent = '需统一快照'; $('#follower-alert-headline').textContent = '粉丝数据来源混合'; $('#follower-alert-summary').textContent = `当前合计 ${formatCount(analysis.latestFollowers)} 粉丝，其中部分来自公开主页快照、部分来自每日导入数据；统一下一次采集口径后，才能准确计算昨日增减。`; $('#follower-alert-meta').textContent = '公开主页快照 + CSV · 先统一采集时间'; return;
  }
  if (!analysis.hasFollowerHistory && analysis.followerSource === '公开主页快照') {
    alert.classList.add('neutral'); badge.classList.add('neutral'); badge.textContent = '公开快照'; status.textContent = '待建立历史'; $('#metric-followers').textContent = formatCount(analysis.latestFollowers); $('#metric-followers-delta').textContent = '暂无昨日快照'; $('#metric-followers-rate').textContent = '待下次同步'; $('#follower-alert-headline').textContent = '已读取公开主页粉丝数'; $('#follower-alert-summary').textContent = `当前公开主页显示 ${formatCount(analysis.latestFollowers)} 粉丝；这是真实页面快照，但没有昨日快照，暂时不能计算增减。下次读取后再比较。`; $('#follower-alert-meta').textContent = `来源：公开主页 · 当前 ${formatCount(analysis.latestFollowers)}`; return;
  }
  const growing = analysis.followerDelta > 0; const declining = analysis.followerDelta < 0; const state = growing ? 'growth' : declining ? 'decline' : 'neutral'; alert.classList.add(state); badge.classList.add(growing ? 'good' : declining ? 'down' : 'neutral'); badge.textContent = growing ? deltaText : declining ? deltaText : '持平'; status.textContent = growing ? '增长中' : declining ? '回落' : '与昨日持平'; $('#metric-followers').textContent = formatCount(analysis.latestFollowers); $('#metric-followers-delta').textContent = `比昨天 ${deltaText}`; $('#metric-followers-rate').textContent = `${analysis.followerDeltaRate >= 0 ? '+' : ''}${(analysis.followerDeltaRate * 100).toFixed(1)}%`; $('#follower-alert-headline').textContent = growing ? `比昨天增加 ${formatCount(analysis.followerDelta)}` : declining ? `比昨天减少 ${formatCount(Math.abs(analysis.followerDelta))}` : '粉丝数量与昨天持平'; $('#follower-alert-summary').textContent = growing ? `今日粉丝 ${formatCount(analysis.latestFollowers)}，增长率 ${(analysis.followerDeltaRate * 100).toFixed(1)}%。继续记录下一次同步，确认增长是否能持续。` : declining ? `今日粉丝 ${formatCount(analysis.latestFollowers)}，较昨日下降 ${(Math.abs(analysis.followerDeltaRate) * 100).toFixed(1)}%。先结合发布量、播放和互动一起判断，不单凭一天数据下结论。` : `今日粉丝 ${formatCount(analysis.latestFollowers)}，暂未出现日增。继续采集数据，观察是否只是单日波动。`; $('#follower-alert-meta').textContent = `昨日 ${formatCount(analysis.yesterdayFollowers)} · 今日 ${formatCount(analysis.latestFollowers)}`;
}

function renderVideoCurve() {
  const svg = $('#video-curve'); const video = getScopeData().videos.find((item) => item.id === selectedVideoId) || getScopeData().videos[0]; if (!video) { svg.innerHTML = '<text class="chart-label" x="30" y="110">没有可展示的视频</text>'; return; } selectedVideoId = video.id; $('#selected-video-title').textContent = video.title; $('#selected-video-meta').textContent = `${video.handle} · 发布时间 ${video.date ? formatPublishedAt(video.date) : '未提供'}`; if (!Array.isArray(video.curve) || video.curve.length < 2) { const currentViews = parseNullableNumber(video.views); svg.innerHTML = `<text class="chart-empty" x="380" y="100" text-anchor="middle">${currentViews === null ? '当前视频播放量待导入' : `当前公开播放 ${formatCount(currentViews)}`}</text><text class="chart-empty" x="380" y="128" text-anchor="middle">尚无重复快照，暂不能绘制播放曲线</text>`; return; }
  const width = 760; const height = 220; const pad = { top: 18, right: 14, bottom: 20, left: 12 }; const maxValue = Math.max(...video.curve) * 1.15; const x = (index) => pad.left + (index / (video.curve.length - 1)) * (width - pad.left - pad.right); const y = (value) => height - pad.bottom - (value / maxValue) * (height - pad.top - pad.bottom); const points = video.curve.map((value, index) => `${x(index)},${y(value)}`).join(' '); const area = `${pad.left},${height - pad.bottom} ${points} ${x(video.curve.length - 1)},${height - pad.bottom}`; const dots = video.curve.map((value, index) => `<circle class="video-curve-dot" cx="${x(index)}" cy="${y(value)}" r="5"><title>${formatNumber(value)}</title></circle>`).join(''); const grid = [.25, .5, .75, 1].map((ratio) => `<line class="chart-grid" x1="${pad.left}" x2="${width - pad.right}" y1="${y(maxValue * ratio)}" y2="${y(maxValue * ratio)}"/>`).join('');
  svg.innerHTML = `<defs><linearGradient id="videoAreaFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="oklch(0.75 0.14 250)" stop-opacity=".20"/><stop offset="1" stop-color="oklch(0.75 0.14 250)" stop-opacity="0"/></linearGradient></defs>${grid}<polygon class="video-curve-area" points="${area}"/><polyline class="video-curve-line" points="${points}"/>${dots}`;
}
function renderDateLabels(daily) {
  if (!daily.length) return '';
  const indices = [...new Set([0, Math.floor(daily.length / 3), Math.floor(daily.length * 2 / 3), daily.length - 1])];
  return indices.map((index) => `<span>${escapeHtml(daily[index].date.slice(5).replace('-', '.'))}</span>`).join('');
}

function renderDiagnosis() {
  const analysis = calculateAnalysis();
  const publicSummary = getPublicVisibleVideoSummary();
  const items = [];
  if (!publicSummary.count) {
    items.push({ type: 'info', icon: 'i', title: '等待公开视频数据', body: '当前账号还没有可比较的公开播放记录。先登记视频链接或读取账号主页，再开始比较。', evidence: '证据：当前没有可见播放量' });
  } else if (!analysis.hasData) {
    items.push({ type: 'info', icon: 'i', title: '已有公开快照，尚无历史趋势', body: `已读取 ${publicSummary.count} 条公开视频，合计 ${formatCount(publicSummary.totalViews)}；再次读取同一批视频后，才能判断播放变化。`, evidence: '证据：当前快照只有一个时间点' });
  } else if (analysis.viewDelta < -.15) {
    items.push({ type: 'warn', icon: '↘', title: '公开播放低于自身基线', body: '先对比低播放视频与高播放视频的开头、主题、画面承接和发布时间；这只是公开数据差异，不等同于限流或违规。', evidence: `证据：近 3 天播放较自身基线低 ${Math.abs(analysis.viewDelta * 100).toFixed(1)}%` });
  } else {
    items.push({ type: 'info', icon: 'i', title: '暂未发现明显公开播放波动', body: '当前公开播放仍在自身历史区间附近，继续用同一口径采集下一批视频。', evidence: '证据：近 3 天未突破公开播放异常阈值' });
  }
  $('#diagnosis-list').innerHTML = items.slice(0, 3).map((item) => `<div class="diagnosis-item"><span class="diagnosis-icon ${item.type}">${item.icon}</span><div><b>${item.title}</b><p>${item.body}</p><small class="diagnosis-evidence">${item.evidence}</small></div></div>`).join('');
}
function setRuleState(key, state, icon, detail, status) { $(`#rule-${key}-icon`).className = `rule-icon ${state}`; $(`#rule-${key}-icon`).textContent = icon; $(`#rule-${key}-detail`).textContent = detail; $(`#rule-${key}-status`).className = `rule-status ${state}`; $(`#rule-${key}-status`).textContent = status; }
function renderRules() {
  const analysis = calculateAnalysis(); const summary = getMonetizationSummary(); const videos = summary.videos; const hasProductIds = videos.some((video) => video.productId); const hasImportedData = getVisibleAccounts().some((account) => account.dataSource === '导入 CSV'); setRuleState('originality', 'neutral', '?', hasImportedData ? '当前仅有指标数据，未包含原创/重复内容审计字段' : '公开主页与播放数据不能证明原创或有效增量', '需核验'); setRuleState('match', hasProductIds ? 'good' : 'neutral', hasProductIds ? '✓' : '?', hasProductIds ? '已导入商品 ID，可继续核对商品与视频标签' : '需要 product_id、SKU 或 Shop 商品数据', hasProductIds ? '有字段' : '需核验'); setRuleState('eligibility', 'neutral', '?', '推荐资格、Shop Tab 资格和账号处罚状态必须以后台提示为准', '需后台核验'); const qualityState = !analysis.hasData ? 'neutral' : analysis.viewDelta < -.15 || analysis.recentComplete - analysis.baselineComplete < -.04 ? 'warn' : 'good'; setRuleState('quality', qualityState, qualityState === 'good' ? '✓' : qualityState === 'warn' ? '!' : '?', !analysis.hasData ? '还没有足够的播放历史' : qualityState === 'warn' ? '播放或完播低于自身基线；这是内容信号，不等同于违规' : '当前播放、完播和互动未形成强异常', qualityState === 'good' ? '稳定' : qualityState === 'warn' ? '观察' : '待数据');
}
function renderActions() {
  const analysis = calculateAnalysis();
  const publicSummary = getPublicVisibleVideoSummary();
  const actions = [];
  if (!publicSummary.count) {
    actions.push({ title: '先登记最近公开视频', body: '添加账号主页或视频链接，并录入页面当前可见播放量；没有公开证据的字段保持空白。', tag: '数据 · 现在' });
  } else if (!analysis.hasData) {
    actions.push({ title: '建立第二次公开快照', body: '再次读取同一批公开视频并保留采集时间，只有两个时间点才能判断公开播放变化。', tag: '数据 · 下一次同步' });
  } else if (analysis.viewDelta < -.15) {
    actions.push({ title: '对比低播放视频的开头', body: '把低播放视频与高播放视频放在一起，检查前 2 秒、主题标签、演示顺序和发布时间差异。', tag: '内容 · 下一批' });
  } else {
    actions.push({ title: '提取高播放视频结构', body: '记录高播放视频的主题、开头、画面顺序和发布时间，下一批只改一个变量做对照。', tag: '内容 · 下一批' });
  }
  if (publicSummary.count >= 2) {
    actions.push({ title: '保持同一口径记录', body: '每次同步使用同一账号列表和相同采集方式，避免把不同时间点或不同页面口径混在一起。', tag: '数据 · 每次同步' });
  }
  actions.push({ title: '只使用可见证据下结论', body: '公开主页无法证明私有算法、违规风险、原创度或后台推荐资格；这些内容不在本看板的自动判断范围内。', tag: '边界 · 始终' });
  $('#action-list').innerHTML = actions.slice(0, 3).map((item, index) => `<li><span class="action-number">${String(index + 1).padStart(2, '0')}</span><div><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.body)}</p><span class="action-tag">${escapeHtml(item.tag)}</span></div></li>`).join('');
}

function renderAccountCards() {
  $('#account-cards').innerHTML = getActiveAccounts().map((account) => { const monitoredVideos = getMonitoredVideosForAccount(account); const publicVideos = monitoredVideos.filter((video) => parseNullableNumber(video.views) !== null); const publicViews = publicVideos.reduce((sum, video) => sum + Number(video.views), 0); const totalViews = account.daily.reduce((sum, day) => sum + day.views, 0); const recent = average(account.daily.slice(-3).map((day) => day.views)); const baseline = median(account.daily.slice(0, 9).map((day) => day.views)); const hasViews = baseline > 0; const hasPublicViews = !hasViews && publicVideos.length > 0; const delta = hasViews ? (recent - baseline) / baseline : 0; const posts = account.daily.reduce((sum, day) => sum + day.posts, 0); const publicPostCount = monitoredVideos.length; const history = getPublicFollowerHistory(account); const dailyFollowers = account.daily.at(-1)?.followers || 0; const hasFollowers = dailyFollowers > 0 || hasPublicFollowerSnapshot(account); const followers = dailyFollowers || history.at(-1)?.value || 0; const followerDelta = dailyFollowers ? followers - (account.daily.at(-2)?.followers || 0) : history.length > 1 ? followers - history.at(-2).value : null; return `<button class="account-card" type="button" data-account-card="${account.id}"><span class="account-card-head"><span><b>${account.handle}</b><small>${account.region}</small></span><span class="account-card-avatar">${account.avatar}</span></span><span class="account-card-metrics"><span><strong>${hasViews ? formatNumber(totalViews) : hasPublicViews ? formatCount(publicViews) : '—'}</strong>${hasPublicViews ? '公开播放' : '播放'}</span><span><strong>${posts || (publicPostCount ? publicPostCount : '—')}</strong>${posts ? '发布' : publicPostCount ? '产品视频' : '发布'}</span><span><strong>${hasFollowers ? formatCount(followers) : '—'}</strong>粉丝</span><span><strong class="${(followerDelta ?? 0) >= 0 ? 'positive' : 'negative'}">${followerDelta === null ? '—' : formatSignedCount(followerDelta)}</strong>昨增</span></span><span class="account-card-foot"><span>${account.name}</span><span class="${hasViews ? (delta >= 0 ? 'positive' : 'negative') : ''}">${hasViews ? `${delta >= 0 ? '+' : ''}${Math.round(delta * 100)}% vs 基线 →` : hasPublicViews ? '公开当前合计 · 非后台14天 →' : '等待导入数据 →'}</span></span></button>`; }).join('');
  document.querySelectorAll('[data-account-card]').forEach((button) => button.addEventListener('click', () => setAccount(button.dataset.accountCard)));
}

function sparklineSvg(curve) { if (!Array.isArray(curve) || curve.length < 2) return '<span class="curve-empty">无历史快照</span>'; const max = Math.max(...curve, 1); const points = curve.map((value, index) => `${(index * 34 + 2).toFixed(1)},${(26 - value / max * 22).toFixed(1)}`).join(' '); return `<svg class="sparkline" viewBox="0 0 140 30" aria-label="播放曲线"><polyline points="${points}"/></svg>`; }

function renderVideos() {
  const { videos } = getScopeData();
  const baseline = calculateAnalysis().baselineViews;
  $('#video-table').innerHTML = videos.length ? videos.sort((left, right) => right.date.localeCompare(left.date)).map((video) => {
    const videoViews = parseNullableNumber(video.views);
    const hasBaseline = baseline > 0 && videoViews !== null;
    const delta = hasBaseline ? (videoViews - baseline) / baseline : 0;
    const deltaClass = delta >= 0 ? 'cell-good' : 'cell-down';
    const source = video.source || '账号登记数据';
    return `<tr class="video-row" data-video-row="${video.id}"><td><div class="video-cell"><span class="video-thumb">${video.thumb}</span><span><b>${escapeHtml(video.title)}</b><small>${escapeHtml(video.id)} · <em class="source-badge ${getDataSourceClass(source)}">${escapeHtml(source)}</em></small></span></div></td><td>${escapeHtml(video.handle)}</td><td><span class="content-tag">${escapeHtml(video.topic || '未标注')}</span></td><td class="published-at">${video.date ? formatPublishedAt(video.date) : '未提供'}</td><td>${videoViews === null ? '待录入' : formatNumber(videoViews)}</td><td>${sparklineSvg(video.curve)}</td><td class="${hasBaseline ? deltaClass : ''}">${hasBaseline ? `${delta >= 0 ? '+' : ''}${Math.round(delta * 100)}%` : '无历史基线'}</td><td><span class="status-text ${video.statusType === 'good' ? 'good' : ''}">${video.status || '已读取'}</span></td><td><button class="ghost-button row-action" type="button">${video.action || '查看记录'} →</button></td></tr>`;
  }).join('') : '<tr><td colspan="9" class="empty-table-cell">当前没有公开视频记录；请在账号登记区添加视频链接和当前可见播放量。</td></tr>';
  document.querySelectorAll('[data-video-row]').forEach((row) => row.addEventListener('click', () => { selectedVideoId = row.dataset.videoRow; renderVideoSelect(); renderVideoCurve(); }));
}

function renderVideoSelect() { const { videos } = getScopeData(); if (!videos.some((video) => video.id === selectedVideoId)) selectedVideoId = videos[0]?.id; $('#video-select').innerHTML = videos.map((video) => `<option value="${video.id}" ${video.id === selectedVideoId ? 'selected' : ''}>${video.handle} · ${video.title}</option>`).join(''); }

function updateSummary() {
  const analysis = calculateAnalysis(); const { daily } = getScopeData(); const publicSummary = getPublicVisibleVideoSummary(); const totalViews = daily.reduce((sum, day) => sum + day.views, 0); const totalPosts = daily.reduce((sum, day) => sum + day.posts, 0); const recentPosts = daily.slice(-3).reduce((sum, day) => sum + day.posts, 0); const hasViews = daily.some((day) => day.views > 0); const hasComplete = daily.some((day) => day.complete > 0); const hasFyp = daily.some((day) => day.fyp > 0); const hasPosts = daily.some((day) => day.posts > 0); const hasPublicViews = !hasViews && publicSummary.count > 0; const hasPublicPosts = !hasPosts && publicSummary.videoCount > 0; const fypDrop = (analysis.recentFyp - analysis.baselineFyp) * 100; const retentionDrop = (analysis.recentComplete - analysis.baselineComplete) * 100; const isAll = scope === 'all'; const selectedAccount = dataset.accounts.find((account) => account.id === selectedAccountId); const activeAccountCount = getActiveAccounts().length; const registeredAccountCount = getRegisteredAccounts().length;
  const setBadge = (selector, text, state = 'neutral') => { const badge = $(selector); if (!badge) return; badge.className = `trend-badge ${state}`; badge.textContent = text; };
  $('#page-title').textContent = isAll ? '账号总面板' : `${selectedAccount?.name || '单账号'} · 播放监测`; $('#page-subtitle').textContent = isAll ? '全部使用中账号 · 播放、发布节奏与视频表现合并视图' : `${selectedAccount?.handle || ''} · 播放、发布节奏与单视频生命周期`; $('#account-avatar').textContent = isAll ? '总' : selectedAccount?.avatar || '号'; $('#account-name').textContent = isAll ? '全部账号' : selectedAccount?.handle || '选择账号'; $('#account-region').textContent = isAll ? `总面板 · ${activeAccountCount} 个使用中 / ${registeredAccountCount} 个已登记` : selectedAccount?.region || ''; $('.scope-tab[data-scope="all"] small').textContent = `${activeAccountCount} 个使用中`;
  $('#metric-views').textContent = hasViews ? formatNumber(totalViews) : hasPublicViews ? formatCount(publicSummary.totalViews) : '待导入'; $('#metric-views-kicker').textContent = hasViews ? '近 14 天' : hasPublicViews ? '公开当前合计' : '近 14 天'; $('#metric-views-trend').textContent = hasViews ? `${analysis.viewDelta >= 0 ? '+' : ''}${(analysis.viewDelta * 100).toFixed(1)}%` : hasPublicViews ? '公开快照' : '待比较'; $('#metric-views-trend').className = hasViews && analysis.viewDelta < 0 ? 'down' : hasViews ? 'cell-good' : 'neutral'; $('#metric-views-period').textContent = hasViews ? 'vs 自身历史基线' : hasPublicViews ? `${publicSummary.count} 条视频合计 · 非后台14天` : '需要近 14 天后台数据';
  $('#metric-posts').textContent = hasPosts ? totalPosts : hasPublicPosts ? publicSummary.videoCount : '待导入'; $('#metric-posts-caption').textContent = hasPosts ? (isAll ? '全部账号近 14 天发布' : '当前账号近 14 天发布') : hasPublicPosts ? '公开主页已读取视频数' : (isAll ? '全部账号近 14 天发布' : '当前账号近 14 天发布'); $('#metric-posts-average').textContent = hasPosts ? `日均 ${(totalPosts / activeRange).toFixed(1)} 条` : hasPublicPosts ? `${publicSummary.timestampCount}/${publicSummary.videoCount} 条已读取精确发布时间` : '等待数据'; setBadge('#metric-posts-badge', hasPosts ? (recentPosts >= average(daily.slice(0, -3).map((day) => day.posts)) * 3 ? '节奏上升' : '节奏稳定') : hasPublicPosts ? '公开快照' : '待导入', hasPosts ? 'good' : 'neutral'); $('#metric-posts-status').textContent = hasPosts ? (recentPosts >= 3 ? '活跃' : '稳定') : hasPublicPosts ? '已读取' : '待导入';
  updateDataProvenance(); renderFollowerAlert(); renderRecentContentMonitor(); renderActions();
  $('#posts-total-large').textContent = hasPosts ? totalPosts : hasPublicPosts ? publicSummary.videoCount : '待录入'; $('#posts-summary-label').textContent = hasPosts ? (isAll ? '条视频 · 全部账号' : '条视频 · 当前账号') : hasPublicPosts ? '条公开视频 · 当前快照' : '发布数量'; $('#posts-summary-detail').textContent = hasPosts ? `日均 ${(totalPosts / activeRange).toFixed(1)} 条 · 最多的一天 ${Math.max(...daily.map((day) => day.posts))} 条` : hasPublicPosts ? `${publicSummary.timestampCount}/${publicSummary.videoCount} 条已读取精确发布时间 · 详情页快照` : '等待公开主页或本地记录'; $('#posts-panel-note').textContent = hasPosts ? `${isAll ? '总面板' : '单账号'} · 近 ${activeRange} 天` : hasPublicPosts ? `${publicSummary.videoCount} 条公开视频 · 详情页时间` : `${isAll ? '总面板' : '单账号'} · 近 ${activeRange} 天`; $('#account-breakdown').style.display = isAll ? '' : 'none';
  renderViewsChart(); renderPostsChart(); renderFollowerSparkline(); renderDiagnosis(); renderVideos(); renderVideoSelect(); renderVideoCurve(); if (isAll) renderAccountCards();
}

function setAccount(accountId) { selectedAccountId = accountId; scope = 'single'; document.querySelectorAll('.scope-tab').forEach((button) => button.classList.toggle('active', button.dataset.scope === 'single')); $('#account-select').value = accountId; $('#registry-account-select').value = accountId; $('#video-link-account-select').value = accountId; syncRegistryForm(); updateSummary(); }
function setScope(nextScope) { scope = nextScope; if (nextScope === 'all') selectedAccountId = 'all'; if (nextScope === 'single' && selectedAccountId === 'all') selectedAccountId = getActiveAccounts()[0]?.id || dataset.accounts[0]?.id; document.querySelectorAll('.scope-tab').forEach((button) => button.classList.toggle('active', button.dataset.scope === nextScope)); $('#account-select').value = nextScope === 'all' ? 'all' : selectedAccountId; updateSummary(); }

document.querySelectorAll('.scope-tab').forEach((button) => button.addEventListener('click', () => setScope(button.dataset.scope)));
$('#account-select').addEventListener('change', (event) => event.target.value === 'all' ? setScope('all') : setAccount(event.target.value));
document.querySelectorAll('.range-button').forEach((button) => button.addEventListener('click', () => { activeRange = Number(button.dataset.range); document.querySelectorAll('.range-button').forEach((item) => item.classList.toggle('active', item === button)); updateSummary(); }));
$('#video-select').addEventListener('change', (event) => { selectedVideoId = event.target.value; renderVideoCurve(); });
$('#content-focus-select').addEventListener('change', (event) => { contentFocus = event.target.value; renderRecentContentMonitor(); });
$('#content-range-select').addEventListener('change', (event) => { contentRange = Number(event.target.value); renderRecentContentMonitor(); });
document.querySelectorAll('[data-scroll]').forEach((button) => button.addEventListener('click', () => document.getElementById(button.dataset.scroll)?.scrollIntoView({ behavior: 'smooth' })));

function getRecordValue(record, keys) { const key = keys.find((candidate) => Object.prototype.hasOwnProperty.call(record, candidate)); return key ? record[key] : ''; }
function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (const character of text) {
    if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) { if (character === '\n' && (cell || row.length)) { row.push(cell.trim()); rows.push(row); row = []; cell = ''; } }
    else cell += character;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  if (rows.length < 2) throw new Error('CSV 至少需要一行表头和一行数据');
  const headers = rows.shift().map((header) => header.replace(/^\uFEFF/, '').trim()); const records = rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
  if (!headers.includes('date') || !headers.includes('views')) throw new Error('CSV 必须包含 date 和 views 列');
  const followersHeader = headers.find((header) => ['followers', 'follower_count'].includes(header)); const daily = records.filter((record) => record.date && !record.video_id && parseNullableNumber(record.views) !== null).map((record) => ({ date: normalizeDateKey(record.date), views: parseNullableNumber(record.views) ?? 0, posts: parseNullableNumber(record.posts) ?? 0, complete: parseNullableNumber(record.complete_rate) ?? 0, fyp: parseNullableNumber(record.fyp_share) ?? 0, engagement: parseNullableNumber(record.engagement_rate) ?? 0, followers: followersHeader ? parseNullableNumber(record[followersHeader]) : null }));
  if (daily.length && daily.length < 5) throw new Error('每日数据至少需要 5 天，才能建立自身基线');
  if (!daily.length && !records.some((record) => record.video_id)) throw new Error('CSV 没有可识别的每日数据或视频数据');
  ensureTimelineDates(daily.map((row) => row.date));
  const targetId = selectedAccountId === 'all' ? getActiveAccounts()[0]?.id : selectedAccountId; const target = dataset.accounts.find((account) => account.id === targetId); if (!target) throw new Error('请先选择一个可用账号，再导入数据');
  const existingRowsByDate = new Map((target.daily || []).map((row) => [normalizeDateKey(row.date), row])); target.dataSource = '导入 CSV'; target.importedData = true; target.daily = dates.map((date) => daily.find((item) => item.date === date) || existingRowsByDate.get(date) || { date, views: 0, posts: 0, complete: 0, fyp: 0, engagement: 0, followers: 0 });
  const videoGroups = new Map(); records.filter((record) => record.video_id).forEach((record) => { const key = String(record.video_id); if (!videoGroups.has(key)) videoGroups.set(key, []); videoGroups.get(key).push(record); });
  const importedVideos = [...videoGroups.entries()].map(([videoId, rowsForVideo], index) => { const orderedRows = [...rowsForVideo].sort((left, right) => String(left.snapshot_time || left.date).localeCompare(String(right.snapshot_time || right.date))); const latest = orderedRows.at(-1); const snapshots = orderedRows.filter((record) => record.snapshot_time && parseNullableNumber(record.views) !== null).map((record) => ({ at: record.snapshot_time, views: parseNullableNumber(record.views) })); const postedAt = orderedRows.find((record) => record.posted_at)?.posted_at || latest.posted_at || latest.date; return { id: videoId, title: latest.title || `Imported video ${index + 1}`, date: postedAt, views: parseNullableNumber(latest.views), topic: latest.content_tag || latest.topic || latest.product || inferContentTopic([latest.title]) || '未标注', format: getRecordValue(latest, ['content_format', 'video_type', 'format']), hook: getRecordValue(latest, ['hook', 'hook_type']), productId: getRecordValue(latest, ['product_id', 'sku']), productClicks: parseNullableNumber(getRecordValue(latest, ['product_clicks', 'product_clicks_count', 'clicks'])), orders: parseNullableNumber(getRecordValue(latest, ['orders', 'order_count'])), gmv: parseNullableNumber(getRecordValue(latest, ['gmv', 'revenue'])), commission: parseNullableNumber(getRecordValue(latest, ['commission', 'creator_commission'])), adSpend: parseNullableNumber(getRecordValue(latest, ['ad_spend', 'spend'])), likes: parseNullableNumber(latest.likes), comments: parseNullableNumber(latest.comments), shares: parseNullableNumber(latest.shares), complete: parseNullableNumber(latest.complete_rate), fyp: parseNullableNumber(latest.fyp_share), status: '待观察', statusType: 'warn', action: '检查承接', thumb: String(index + 1), source: '导入 CSV', snapshots, curve: snapshots.length > 1 ? snapshots.map((snapshot) => snapshot.views) : [] }; });
  if (importedVideos.length) target.videos = importedVideos;
  saveImportedData();
  scope = 'single'; selectedAccountId = target.id; $('#account-select').value = target.id; document.querySelectorAll('.scope-tab').forEach((button) => button.classList.toggle('active', button.dataset.scope === 'single')); updateSummary();
  return { dailyCount: daily.length, videoCount: importedVideos.length };
}

$('#csv-input').addEventListener('change', async (event) => { const file = event.target.files[0]; if (!file) return; try { const result = parseCsv(await file.text()); $('.table-note').textContent = `数据源：已导入 ${file.name} · ${result.dailyCount ? `${result.dailyCount} 天每日数据` : '无每日数据'}${result.videoCount ? ` · ${result.videoCount} 条视频明细` : ''} · 已写入当前浏览器本地。平台后台数据仍是最终核验依据。`; } catch (error) { window.alert(`导入失败：${error.message}`); } finally { event.target.value = ''; } });

$('#registry-account-select').addEventListener('change', syncRegistryForm);
$('#account-link-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const accountId = $('#registry-account-select').value;
  try {
    const homepageUrl = validateTikTokUrl($('#homepage-url').value.trim(), '主页链接');
    const note = $('#account-note').value.trim();
    const rawFollowers = $('#account-followers').value.trim();
    const followersSnapshot = rawFollowers === '' ? null : Math.max(0, Number(rawFollowers) || 0);
    const snapshotAt = $('#account-snapshot-at').value || new Date().toISOString().slice(0, 10);
    const account = accountId === 'new' ? createRegisteredAccount(homepageUrl, note) : dataset.accounts.find((item) => item.id === accountId);
    if (!account) throw new Error('请选择要保存的账号');
    const previousRecord = linkRegistry[account.id] || {};
    const followerSnapshots = Array.isArray(previousRecord.followerSnapshots) ? previousRecord.followerSnapshots : [];
    if (followersSnapshot !== null) followerSnapshots.push({ at: snapshotAt, value: followersSnapshot });
    const followerHistory = new Map(followerSnapshots.map((row) => [row.at, row]));
    linkRegistry[account.id] = { ...previousRecord, homepageUrl, note, followersSnapshot: followersSnapshot === null ? previousRecord.followersSnapshot ?? null : followersSnapshot, followersCheckedAt: followersSnapshot === null ? previousRecord.followersCheckedAt || '' : snapshotAt, followerSnapshots: [...followerHistory.values()].sort((left, right) => String(left.at).localeCompare(String(right.at))), videos: previousRecord.videos || [] };
    if (followersSnapshot !== null) { account.dataSource = '公开主页快照'; account.region = '公开快照 · 后台数据待导入'; }
    if (accountId !== 'new' && note) account.name = note;
    saveRegisteredAccounts(); saveLinkRegistry(); populateAccountSelectors(); populateRegistrySelects(); $('#registry-account-select').value = account.id; $('#video-link-account-select').value = account.id; $('#account-select').value = account.id; selectedAccountId = account.id; scope = 'single'; document.querySelectorAll('.scope-tab').forEach((button) => button.classList.toggle('active', button.dataset.scope === 'single')); renderLinkRegistry(); updateSummary();
  } catch (error) { window.alert(`保存失败：${error.message}`); }
});
$('#video-link-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const accountId = $('#video-link-account-select').value;
  try {
    const url = validateTikTokUrl($('#video-url').value.trim(), '视频链接');
    const note = $('#video-note').value.trim();
    const rawViews = $('#video-views').value.trim();
    const views = rawViews === '' ? null : Math.max(0, Number(rawViews) || 0);
    const snapshotAt = $('#video-snapshot-at').value || new Date().toISOString();
    linkRegistry[accountId] = linkRegistry[accountId] || { homepageUrl: '', note: '', videos: [] };
    const record = linkRegistry[accountId];
    const existing = record.videos.find((video) => video.url === url);
    const snapshot = views === null ? null : { at: snapshotAt, views };
    if (existing) {
      existing.note = note || existing.note;
      existing.topic = $('#video-topic').value.trim() || existing.topic || inferContentTopic([note]) || '未标注';
      existing.format = $('#video-format').value || existing.format || '';
      existing.hook = $('#video-hook').value.trim() || existing.hook || '';
      existing.postedAt = $('#video-posted-at').value || existing.postedAt || '';
      existing.views = views === null ? existing.views ?? null : views;
      const snapshotHistory = new Map([...(existing.snapshots || []), ...(snapshot ? [snapshot] : [])].map((row) => [row.at, row]));
      existing.snapshots = [...snapshotHistory.values()].sort((left, right) => String(left.at).localeCompare(String(right.at)));
    } else {
      record.videos.push({ url, note, topic: $('#video-topic').value.trim() || inferContentTopic([note]) || '未标注', format: $('#video-format').value, hook: $('#video-hook').value.trim(), postedAt: $('#video-posted-at').value, views, snapshotAt, snapshots: snapshot ? [snapshot] : [], addedAt: new Date().toISOString() });
    }
    saveLinkRegistry(); renderLinkRegistry(); renderRecentContentMonitor(); updateSummary(); $('#video-url').value = ''; $('#video-note').value = ''; $('#video-topic').value = ''; $('#video-format').value = ''; $('#video-hook').value = ''; $('#video-posted-at').value = ''; $('#video-snapshot-at').value = ''; $('#video-views').value = '';
  } catch (error) { window.alert(`添加失败：${error.message}`); }
});

$('#export-button').addEventListener('click', () => {
  const { videos } = getScopeData();
  const baseline = calculateAnalysis().baselineViews;
  const header = 'account,video_id,title,posted_at,snapshot_time,content_tag,content_format,hook,views,baseline_delta,status,action,source';
  const lines = videos.map((video) => [video.handle, video.id, video.title, video.date || '', video.snapshotTimes?.at(-1) || video.snapshotAt || '', video.topic || '未标注', video.format || '', video.hook || '', video.views ?? '', baseline && video.views !== null ? `${(((video.views - baseline) / baseline) * 100).toFixed(1)}%` : '', video.status || '', video.action || '', video.source || ''].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','));
  const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'tiktok-public-video-data.csv';
  link.click();
  URL.revokeObjectURL(url);
});

populateAccountSelectors(); populateRegistrySelects(); renderLinkRegistry(); updateSummary();
