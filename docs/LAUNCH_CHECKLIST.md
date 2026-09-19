# Friyo 1.0 上线准备与验收

首发范围：iOS、邮箱账号及找回密码、Google / Apple 登录、冰箱、菜谱、烹饪记录、饮食计划、AI、推送。社区仍关闭。

**当前不可直接提交正式发布。** 代码检查通过不等于云端部署、真机登录、推送或审核通过。

## 发布阻塞项

- [ ] 恢复后端：2026-09-18，旧 Railway 地址的公开健康接口返回 `Application not found`。配置新的 `EXPO_PUBLIC_API_URL`，必须包括 `/api/v1`。
- [ ] 设置公开支持邮箱、可公开访问的隐私政策 URL；核实真实运营主体、保留期限、AI 服务商及删除后的备份保留规则。不要把占位文字发布到商店。
- [ ] 在预发布 PostgreSQL 跑完迁移 001–005，并核实已有生产数据库的 migration history。不要在未核查历史时直接对既有数据库执行初始建表。
- [ ] 在真机验证 Google、Apple 的首次登录、返回用户、取消、错误和删除后重新注册。
- [ ] 配置 APNs／Expo 推送凭证，验证前台、后台、杀进程、拒绝权限、退出账号及切换账号。
- [ ] AWS SES 完成发信域名验证并离开 sandbox，验证找回密码邮件实际送达。
- [ ] 配置 S3 权限及已删除对象的版本/备份生命周期，验证账号删除清理任务没有失败。
- [ ] 在实际发布 commit 上重跑依赖审计；参见 `VALIDATION.md`。移动端、后端和后台本次生产依赖检查均为零报告项。
- [ ] 完成下文真机验收、TestFlight 和商店资料，再批准正式发布。

## 本次已实施

- 统一移动端及后台 API 响应拆解；修复并发 token 续期、轮换与失效处理、启动缺缓存卡住及字体加载失败卡住。
- 修复冰箱新增/编辑/扣减的字段命名与后端 DTO 不一致。
- 邮箱找回密码：SES 发信，15 分钟一次性随机码，重置后撤销会话并阻止旧 access token。
- Google 原生 SDK 登录、服务端签名/issuer/audience/邮箱验证；Apple 原生登录、一次性 nonce、授权码交换、加密保存 refresh token、删除时撤销 Apple 授权。
- 不按相同邮箱自动合并不同登录方式，避免账户接管。用户需使用原注册方式登录。
- 推送：设置页主动开启/关闭、设备令牌注册、退出解绑、点击跳转、Expo ticket/receipt 检查与无效令牌清理；后台改为持久队列。
- 上传体积限制、图片解码/重编码及元数据清除；删除账号后排队清理上传文件和个人缓存。
- 开启实际执行的 API 限流，健康检查在依赖故障时返回 503，生产配置缺失时阻止启动。
- 去除初始化管理员默认密码及密码日志，修复初始化管理员重复哈希。
- 升级 NestJS 11、Firebase 14、Next.js 15 及相关安全补丁，移除未使用的缓存配置和旧 SDK。移动端 postinstall 对 Expo SDK 54 的 Metro 图片输入及 query-string ESM decoder 做显式兼容适配；升级 Metro/Expo 时须复核该脚本。
- 增加回归测试、CI、预发布 API 冒烟脚本、EAS 环境检查和生成原生工程的构建路径。

## 环境配置

使用 Node 22.12+；依赖按各项目的 `package-lock.json` 安装。根目录不是单一 npm 应用。

移动端 EAS `preview` / `production` 环境：

| 变量 | 内容 |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | 公网 HTTPS API，结尾 `/api/v1` |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google Web OAuth client ID，用作服务端 audience |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | 与 `com.friyo.app` 匹配的 iOS OAuth client ID |
| `EXPO_PUBLIC_SUPPORT_EMAIL` | 实际有人处理的支持邮箱 |
| `EXPO_PUBLIC_PRIVACY_URL` | 已发布、无需登录的隐私政策 URL |

上述 `EXPO_PUBLIC_*` 会打包到客户端，不能放密钥。Google client secret、Apple `.p8`、JWT、数据库和 Expo 推送 access token 只放后端 secret manager。

后端：按 `.env.example` 配置 PostgreSQL、Redis、三个不同的 32 字符以上 JWT secret、S3、SES、AI provider。额外配置：

- `GOOGLE_CLIENT_IDS`：接受的 Google audience，逗号分隔，至少包括移动端 Web client ID。
- `APPLE_CLIENT_ID=com.friyo.app`、`APPLE_TEAM_ID`、`APPLE_KEY_ID`、`APPLE_PRIVATE_KEY`。
- `OAUTH_TOKEN_ENCRYPTION_KEY`：`openssl rand -hex 32` 生成；需备份，不可直接轮换，否则已有 Apple token 无法解密撤销。
- `EXPO_ACCESS_TOKEN`：若开启 Expo enhanced push security，必须设置；使用最小权限 token。
- `DB_SSL_REJECT_UNAUTHORIZED=true` 默认校验证书；使用供应商 CA。只有供应商私网部署明确需要时才评估关闭校验。
- `TRUST_PROXY_HOPS`：按真实负载均衡层数配置，默认 0；同时在网关做共享限流。本地限流不能代替多实例/WAF 限流。
- `SEED_ADMIN_USERNAME`、`SEED_ADMIN_EMAIL`、`SEED_ADMIN_PASSWORD`（至少 16 字符）：仅初始化时提供；不在日志中记录密码。历史默认管理员应人工轮换。

管理后台：`NEXT_PUBLIC_API_URL=https://.../api/v1`、`NEXTAUTH_URL`、随机 `NEXTAUTH_SECRET`。

## 构建与部署顺序

1. 在预发布准备独立数据库、Redis、S3、AI 配额及凭证，开启数据库备份。保留上一版本镜像。
2. 后端执行 `npm ci`、`npm run build`、`npm test -- --runInBand`、`npm audit --omit=dev --audit-level=high`。
3. 对迁移历史及备份确认后，在 release job 执行 `npm run migration:show:prod`、`npm run migration:run:prod`。应用不自动迁移。005 添加 Apple token、密码变更时间和 Expo 令牌类型，并消除同设备多账号绑定。
4. 部署后端及队列消费者，检查 `/api/v1/health` 同时报告 PostgreSQL / Redis connected。验证密码邮件、S3、AI、Expo 回执。
5. 仅对预发布运行：`FRIYO_API_URL=https://.../api/v1 FRIYO_SMOKE_STAGING=true node scripts/smoke-api.mjs`。脚本创建随机测试账号并在最后删除；不会给真实用户发邮件或推送。
6. 后台执行 `npm ci`、`npm run build`，验证真实管理员登录、权限和各运营页面；不要仅以页面能打开作为通过。
7. 移动端执行 `npm ci`、`npm run typecheck`、`npm test`、`npm run release:check`。
8. `eas build --platform ios --profile preview`，真机验收后再 `eas build --platform ios --profile production`。`.easignore` 排除现有 `ios/`，由 config plugins 生成一致的 Apple / Google / Push 原生配置。若直接用本地 Xcode，需要先运行 `npm run prepare:ios` 并安装 Pods。
9. EAS remote build number 自动递增；首次构建前核对已有商店 build number，避免重复。不得仅修改 `app.json` 就认定原生配置生效。
10. 经 TestFlight 验收后再提交审核；本次没有执行云端部署、EAS 构建或商店提交。

## 真机验收（每项记录设备、版本、结果、证据）

| 场景 | 通过标准 |
| --- | --- |
| 邮箱注册与登录 | 正确引导；无效邮箱/短密码有提示；重复邮箱不重复建号 |
| 找回密码 | 邮件到达；错误/过期/重复使用验证码均失败；新密码可用、旧会话失效 |
| Google / Apple | 首次和再次登录均正确；取消不报成功；停用用户无法登录；Apple 隐藏邮箱可用 |
| 会话 | 重启恢复；15 分钟过期自动续期；多个并行请求只续期一次；断网不误清除凭据 |
| 冰箱 | 添加、修改数量/位置/日期、删除及刷新一致；拒绝相机权限可返回；扫描失败可重试 |
| AI | 未同意前不发送聊天/图片；拒绝和撤销有效；无配额/超时有可理解反馈 |
| 烹饪/计划 | 菜谱→烹饪→餐食保存→周/月记录完整；库存扣减无重复；时区边界日期正确 |
| 推送 | 主动开启；消息实际到达；receipt 成功；拒绝权限不阻塞其他功能；退出后不再发送旧账号消息 |
| 切换账号 | 冰箱、聊天、偏好、查询缓存及推送归属不串号 |
| 删除账号 | 数据库级联删除、旧会话失效、Apple 撤销成功、S3 清理任务成功、设备 token 删除 |
| 稳定性 | 冷启动、慢网、断网、后台恢复、权限拒绝无死循环/白屏；长文和大字体可操作 |

## 商店资料与运营

- 名称建议：Friyo；副标题草稿：Plan meals with your fridge。
- 描述草稿：Track food in your fridge, discover recipes, plan meals, and record what you cook. Scan ingredients with AI assistance and enable reminders to help you use food before it expires.
- 审核说明：说明登录方式；提供独立审核账号；说明 Settings 中通知开启、AI 数据授权和 Delete Account 路径；确保审核地区能访问后端。
- 使用真实当前版本截图，核对图标尺寸、隐私清单、SDK required-reason API 报告、年龄分级、内容授权及出口合规回答。
- App Privacy 逐项核对账号、照片、饮食偏好、AI 输入、设备推送 token、诊断数据；表单必须反映真实 provider 行为。
- 监控 API 错误率、延迟、队列失败、Expo receipt、S3 删除任务、AI 花费及 SES 退信；安排实际负责人。
- 数据库定时备份及恢复演练。回滚先回滚应用镜像；005 的新增字段可保留，不在紧急回滚时删除授权数据。

## 官方参考

- [Apple 审核指南](https://developer.apple.com/app-store/review/guidelines/)
- [Apple 账号删除](https://developer.apple.com/support/offering-account-deletion-in-your-app)
- [Apple 授权撤销](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple)
- [Expo 推送与回执](https://docs.expo.dev/push-notifications/sending-notifications/)
- [Expo 版本号管理](https://docs.expo.dev/build-reference/app-versions/)
