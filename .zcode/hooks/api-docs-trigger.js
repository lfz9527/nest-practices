// 检测接口相关文件变更，提示使用 api-docs 技能更新接口文档（api-docs.md）
// 由 ZCode PostToolUse hook 调用：stdin 传入 hook 事件 JSON，含 tool input.file_path
let input = ''
process.stdin.on('data', (chunk) => {
  input += chunk
})
process.stdin.on('end', () => {
  let data
  try {
    data = JSON.parse(input)
  } catch {
    // stdin 非 JSON（如空输入），静默通过
    process.exit(0)
  }

  const filePath = data?.input?.file_path ?? ''
  const normalized = filePath.replace(/\\/g, '/')
  // 接口相关：控制器/DTO/实体/seed 初始账号/全局配置（端口等）
  const isApiRelated =
    /(?:controller|dto|entity)\.ts$/.test(normalized) ||
    /seed\.ts$/.test(normalized) ||
    /(?:^|\/)config\.ya?ml$/.test(normalized)

  if (!isApiRelated) {
    process.exit(0)
  }

  process.stdout.write(
    JSON.stringify({
      additionalContext: `接口相关文件已变更：${filePath}。请使用 api-docs 技能更新接口文档（项目根 api-docs.md，含初始账号/端口等头部信息核对）。`,
    }),
  )
})
