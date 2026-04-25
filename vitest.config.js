// Vitest 設定檔
// 設計文件參考：openspec/changes/add-ibn5100-terminal/design.md Decision 3。
// 預設於 Node 環境執行（純函式測試），個別測試檔可在頂部用
// `// @vitest-environment jsdom` 自行切換到 jsdom。
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.js'],
  },
});
