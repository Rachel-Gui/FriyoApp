# Validation record — 2026-09-18

## 实际完成的检查

| 检查 | 结果 | 边界 |
| --- | --- | --- |
| 移动端 TypeScript | 通过 | 不代表真机行为通过 |
| 移动端接口回归 | 8/8 通过 | fetch / SecureStore 使用测试替身 |
| Expo SDK 54 依赖兼容检查 | 通过 | 离线使用 SDK 内置版本表 |
| iOS Metro / Hermes export | 通过，1767 模块 | 不是签名 IPA / Xcode 编译 |
| iOS config plugin prebuild | 通过 | 用验证用 Google ID 检查 scheme；没有真实 provider 授权 |
| 原生 entitlement | 包含 Apple Sign In、aps-environment | 发布证书及 provisioning profile 尚未验证 |
| 后端 Nest 构建 | 通过 | 未连接真实数据库和 Redis |
| 后端回归 | 25/25 通过 | 认证、密码找回、刷新轮换、真实本地 HTTP/限流、真实图片解码、健康检查、Expo 回执；外部服务使用测试替身 |
| bcrypt 6 native runtime | 哈希/比对通过 | 本机运行环境 |
| 管理后台 Next.js 15.5.25 生产构建 | 通过，15 routes | 未验证真实管理员 API 登录 |
| App 图标 | 使用已有 1024×1024 RGB 图标 | 未新增或生成品牌设计 |
| 发布环境预检 | 正确拒绝缺失配置 | 当前实际环境没有 release variables |
| git diff whitespace check | 通过 | 无提交或推送 |
| 旧 Railway 公开健康地址 | 返回 Application not found | 必须恢复或更换后端地址 |

移动端及后端依赖在 `/private/tmp/friyo-release-validation/` 干净安装并验证；已有工作区依赖目录的安装和同步持续停滞，已停止这些操作；工作区的 node_modules 尚未完成更新。源码和 lockfile 才是交付依据；新机器应使用 `npm ci`。

## 未执行，不能标记通过

- PostgreSQL migration 001–005、Redis 队列及完整 API smoke：本机 Docker daemon 未启动，没有可用预发布后端。
- CI pipeline 已加入仓库，但没有推送，因此没有远程 CI 运行结果。
- Apple / Google 凭证验证、Apple token 实际撤销、SES 邮件、S3 文件删除、AI provider 实测、APNs / Expo 真机送达。
- 原生 Pods 安装、Xcode archive、EAS 云端构建、签名、TestFlight、App Store Connect 提交。
- App Store 隐私表单、真实支持邮箱、政策公开地址、审核账号、实际用户验收和备份恢复演练。

## 生产依赖审计

使用 npm 官方 registry 的 `npm audit --omit=dev`。这是依赖公告检查，不等于完整安全审计；数量会随公告更新改变。

- Backend (NestJS 11.2.5 / Firebase 14.4.0): critical 0, high 0, moderate 0, low 0.
- Admin (Next.js 15.5.25): critical 0, high 0, moderate 0, low 0.
- Mobile (Expo SDK 54, patched tooling): critical 0, high 0, moderate 0, low 0.

移动端保留 SDK 54，并通过 postinstall 的 `scripts/patch-metro.cjs` 适配新版 image-size 的 Buffer 输入及新版 URI decoder 的 ESM 导出；类型检查、URL 回归和 Hermes bundle 验证是这一兼容层的发布门槛。

后端框架升级已通过 TypeScript 构建和 25 项回归，包含真实 Nest/Express HTTP 请求。数据库迁移和第三方服务仍必须在预发布完成集成验收，不能用单元测试代替。发布 commit 应重跑审计，公告与依赖版本可能改变。

## 已确认的外部配置缺口

发布检查当前要求：`EXPO_PUBLIC_API_URL`、Google Web/iOS IDs、支持邮箱、隐私 URL。后端启动前还需真实数据库/Redis、JWT secrets、Apple key、OAuth 加密 key、S3/SES/AI 配置。

详见 [上线清单](LAUNCH_CHECKLIST.md)。本次没有发布、发邮件、给真实用户发送推送、执行生产数据库迁移或更改任何线上账号配置。
