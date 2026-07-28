module.exports = {
  // 1. 类型定义：引入 Emoji，视觉更直观；严格对齐名称；去除了重复的 minus
  types: [
    { value: 'feat', name: '✨ feat: 新增功能 (Feature)' },
    { value: 'fix', name: '🐛 fix: 修复缺陷 (Bugfix)' },
    { value: 'ui', name: '💄 ui: 更新UI界面或样式' },
    { value: 'util', name: '🔧 util: 工具函数/hooks/公共模块' },
    {
      value: 'style',
      name: '🎨 style: 代码格式 (不影响逻辑的空格、格式化等)',
    },
    {
      value: 'refactor',
      name: '♻️  refactor: 代码重构 (非新增功能也非修bug的代码变动)',
    },
    { value: 'docs', name: '📝 docs: 文档更新 (Documentation)' },
    { value: 'test', name: '✅ test:增加或修改测试用例' },
    { value: 'chore', name: '🔧 chore:更改配置文件、构建工具等' },
    { value: 'add', name: '📦 add: 添加或更新依赖库' },
    { value: 'del', name: '🔥 del: 清理无用代码或文件' },
    { value: 'revert', name: '⏪ revert:回滚到上一个版本' },
    { value: 'release', name: '🔖 release: 发布新版本' },
    { value: 'deploy', name: '🚀 deploy:部署项目' },
    { value: 'init', name: '🎉 init: 项目初始化' },
  ],

  scopes: [],

  // 2. 提示语优化：去除了多余的 \n（cz底层会自动换行），话术更清晰友好
  messages: {
    type: '请选择您要提交的更改类型:',
    // scope: '请输入更改的范围 (可选, 如: 组件名/文件名):',
    // customScope: '请输入自定义的范围:',
    subject: '请简明扼要地描述更改内容 (必填):',
    body: '请提供详细的更改描述 (可选, 使用 "|" 换行):',
    breaking: '列出任何非兼容性的破坏性变更 (可选):',
    footer: '列出所有关联关闭的 Issue 号 (可选, 如: #31, #34):',
    confirmCommit: '您确认使用以上信息进行提交吗?',
  },

  allowCustomScopes: true,
  allowBreakingChanges: ['feat', 'fix'],

  // 3. 提效配置：限制标题总长度，防止触发 commitlint 长度报错
  subjectLimit: 100,

  // 4. 提效配置：默认跳过详细描述和关联 Issue，极大提升日常提交效率（如需要可在此数组中移除）
  skipQuestions: ['scope', 'breaking', 'footer'],
};
