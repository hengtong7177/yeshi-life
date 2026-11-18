# L1 操作卡：免费 HTTPS 托管 + 二维码引流（零成本、零资质）

> 目标：把游戏挂到一个免费 HTTPS 网址，生成二维码发到微信群/朋友圈，7 天内验证「打开率 + 次日留存」。
> 本目录 `L1_发布包/` 里只有两个静态文件（`index.html`、`wechat_entry.html`），**不需要** `server.cjs`，**不需要** node_modules，直接整目录上传即可。

---

## 一、三选一：选一个免费托管平台（推荐顺序 1 > 2 > 3）

### 方案 1 · GitHub Pages（最稳、永久免费、全球可达）
1. 打开 https://github.com → 右上角 Sign up 注册（填邮箱、设密码，免费）。
2. 登录后点右上角 `+` → `New repository`。
3. Repository name 填 `yeshi-life`（可自改），勾选 **Public**，点 `Create repository`。
4. 进入仓库点 `uploading an existing file`（或 Add file → Upload files）。
5. 把本目录的 `index.html` 和 `wechat_entry.html` **两个文件**拖进去 → 点 `Commit changes`。
6. 仓库页面点顶部 `Settings` 标签 → 左侧找 `Pages` → Source 下拉选 `main`、路径选 `/ (root)` → `Save`。
7. 等 1–3 分钟刷新，页面顶部会出现绿色提示：`Your site is live at https://<你的用户名>.github.io/yeshi-life/`。
8. **你的试玩链接** = 上面地址后加 `wechat_entry.html`，例如：
   `https zhangshan.github.io/yeshi-life/wechat_entry.html`（去掉空格，实际是 https://...）。
9. 手机浏览器打开这个链接验证能玩。

### 方案 2 · Gitee Pages（国内访问快；免费版需实名）
1. 打开 https://gitee.com → 注册（手机号，免费）。
2. 点 `+` → `新建仓库`，名称 `yeshi-life`，勾选公开，创建。
3. 上传本目录两个文件 → 提交。
4. 仓库页面点 `服务` → `Gitee Pages` → 选分支 `master/main` → 点 `启动/更新`。
5. 得到 `https://<你的用户名>.gitee.io/yeshi-life/` → 同样加 `wechat_entry.html` 即试玩链接。
6. 注：Gitee 免费版可能要求实名认证，按提示用身份证在 App 里刷脸即可（这是你本人操作）。

### 方案 3 · 腾讯云 CloudBase 静态托管（国内最快、有免费额度）
1. 打开 https://console.cloud.tencent.com/tcb → 微信扫码登录。
2. 新建环境 → 选「静态网站托管」→ 按向导开通（有免费额度）。
3. 进入「静态网站托管」→ 上传本目录两个文件到根目录。
4. 系统会分配一个 `https://xxx.tcloudbaseapp.com` 的默认域名 → 加 `wechat_entry.html` 即试玩链接。

---

## 二、生成真实二维码（工具已备好）

拿到上面的 HTTPS 试玩链接后：

1. 打开 `_qrtool/links.txt`（在 `夜市人生/_qrtool/` 目录），把示例链接替换成你的真实链接，文件名可自定，例如：
   ```
   https://zhangsan.github.io/yeshi-life/wechat_entry.html 我的二维码.png
   ```
2. 在 `_qrtool` 目录打开命令行，运行：
   ```
   node gen_qr.cjs
   ```
   或者不改文件，直接一行命令生成：
   ```
   node gen_qr.cjs "https://你的链接/wechat_entry.html" 我的二维码.png
   ```
3. 生成的 PNG 在 `_qrtool/qr_output/` 目录，可直接保存/打印/发朋友圈。

> 依赖说明：`_qrtool/node_modules` 里已内置 qrcode 库，无需联网安装。若提示找不到 node，用完整路径：
> `"C:\Program Files\nodejs\node.exe" gen_qr.cjs "链接" 名称.png`

---

## 三、引流动作（拿到二维码后今天就做）

| 渠道 | 具体动作 | 钩子文案（可直接复制） |
|---|---|---|
| 微信群 | 发二维码 + 一句 | 「凌晨两点的夜市，从一张小桌开始，免费试玩→」 |
| 朋友圈 | 二维码图 + 短文案 | 「摊子底下压着一只落灰木匣，凑齐六片线索才知道这条街的秘密」 |
| 小红书 | 图文笔记 | 「钱不够进货怎么办？这游戏把小人物的难处全写进去了」 |
| B站简介 | 放链接 | 「试玩链接在主页」 |

---

## 四、验证留存的判定线（决定是否进 L2/L3）

- 记录 3 个数字：**7 日内打开人数**、**次日再来人数**、**有人玩到收摊结算的比例**。
- 达标线（经验值）：打开 ≥30 人 **且** 次日留存 ≥20% → 值得进 L2/L3。
- 不达标：先换钩子文案/渠道再测一轮，不要急着做小游戏改造（那是重投入）。

> 注意：当前版本存档在浏览器本地，换手机/清缓存会丢档——这在 L1 验证期是**可接受的**（用户当场能玩完一天即可）。云存档会在 L3 小游戏版补上。

---

## 五、L1 完成标志

- [ ] 有一个 `https://` 开头的试玩链接，手机能打开玩到收摊
- [ ] 有一张真实可用的二维码 PNG
- [ ] 至少发了 1 个渠道，记录了打开数据

完成上面三项 → 告诉我，进入 L2（公众号 H5 + 文章流量主）。
