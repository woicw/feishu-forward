const TITLE_KEYS = ['title', 'text', 'message', 'subject']

/**
 * Format an arbitrary webhook payload into a Feishu rich-text (post) message.
 */
export function formatPayload(payload) {
  let title = 'Webhook 通知'
  let bodyData = payload

  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    for (const key of TITLE_KEYS) {
      if (typeof payload[key] === 'string' && payload[key].trim()) {
        title = payload[key]
        const { [key]: _, ...rest } = payload
        bodyData = rest
        break
      }
    }
  }

  const contentLines = buildContentLines(bodyData)

  return {
    msg_type: 'post',
    content: {
      post: {
        zh_cn: {
          title,
          content: contentLines,
        },
      },
    },
  }
}

function buildContentLines(data) {
  if (data === null || data === undefined) {
    return [[{ tag: 'text', text: '(empty)' }]]
  }

  if (typeof data !== 'object') {
    return [[{ tag: 'text', text: String(data) }]]
  }

  const lines = []
  for (const [key, value] of Object.entries(data)) {
    const displayValue = typeof value === 'object'
      ? JSON.stringify(value)
      : String(value)
    lines.push([
      { tag: 'text', text: `${key}: ` },
      { tag: 'text', text: displayValue },
    ])
  }

  return lines.length > 0 ? lines : [[{ tag: 'text', text: '(empty)' }]]
}
