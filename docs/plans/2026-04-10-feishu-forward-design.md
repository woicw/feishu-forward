# Feishu Forward — 通用 Webhook 转发服务设计

## 概述

一个轻量的 Hono (Node.js) HTTP 服务，接收任意平台的 webhook POST 请求，将 payload 格式化为飞书富文本消息，转发到飞书群自定义机器人。

## 架构

```
外部平台 --POST /webhook--> Hono 服务 --POST--> 飞书群机器人 webhook
```

单进程 HTTP 服务，无数据库，无状态。

## 核心功能

1. **接收端**：`POST /webhook` 接收任意 JSON payload
2. **格式化**：将 JSON payload 格式化为飞书富文本（post 类型）消息
3. **转发**：调用飞书自定义机器人 webhook API（`https://open.feishu.cn/open-apis/bot/v2/hook/xxx`）
4. **签名**：支持飞书机器人的签名校验（HmacSHA256 + Base64）
5. **健康检查**：`GET /` 返回服务状态

## 飞书 API 细节

- 请求方法：POST，Content-Type: application/json
- 请求体最大 20KB
- 限流：100 次/分钟，5 次/秒
- 签名算法：`Base64(HmacSHA256(timestamp + "\n" + secret))`
- 签名时 timestamp 和 sign 放在请求 body 顶层

### 富文本消息格式

```json
{
  "msg_type": "post",
  "content": {
    "post": {
      "zh_cn": {
        "title": "标题",
        "content": [
          [{"tag": "text", "text": "内容"}]
        ]
      }
    }
  }
}
```

## 配置

通过环境变量（`.env` 文件）：

| 变量 | 必填 | 说明 |
|------|------|------|
| `FEISHU_WEBHOOK_URL` | 是 | 飞书机器人 webhook 地址 |
| `FEISHU_SECRET` | 否 | 签名密钥（机器人开启签名校验时需要） |
| `PORT` | 否 | 服务端口，默认 3000 |

## 技术栈

- Node.js + JavaScript（非 TypeScript）
- Hono + @hono/node-server
- 内置 fetch（无需额外 HTTP 客户端）
- pnpm 包管理
- dotenv 加载环境变量

## 项目结构

```
feishu-forward/
├── src/
│   ├── index.js          # 入口，启动 Hono 服务
│   ├── feishu.js         # 飞书 API 封装（发送消息、签名计算）
│   └── formatter.js      # payload → 飞书富文本消息格式化
├── .env.example          # 环境变量模板
├── .gitignore
└── package.json
```

## 消息格式化策略

收到 webhook payload 后：

1. 尝试从 payload 中提取 `title`、`text`、`message` 等常见字段作为标题
2. 若无法提取，使用 "Webhook 通知" 作为默认标题
3. 将 payload 的关键字段格式化为飞书富文本的多行内容
4. 对于无法识别结构的 payload，将 JSON 格式化为可读文本展示

## 部署

自有服务器直接运行：

```bash
pnpm install
node src/index.js
```

可配合 PM2 或 systemd 进行进程管理。
