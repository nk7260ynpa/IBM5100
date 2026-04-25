## ADDED Requirements

### Requirement: BASIC tokenizer

The system SHALL provide a tokenizer that converts a single BASIC source line into an ordered token stream usable by the parser.

#### Scenario: 數字、字串、識別字、運算子分類正確

- **WHEN** 輸入字串 `LET A = 1.5 + "X"`
- **THEN** tokenizer 產出 token 序列：`{t:'id',v:'LET'}`, `{t:'id',v:'A'}`, `{t:'op',v:'='}`, `{t:'num',v:1.5}`, `{t:'op',v:'+'}`, `{t:'str',v:'X'}`
- **AND** 數字必須支援整數、小數、與前導小數點（`.5`）三種寫法

#### Scenario: 多字元運算子被正確識別

- **WHEN** 輸入 `IF X <= 3 AND Y <> 0`
- **THEN** token 包含 `{t:'op',v:'<='}` 與 `{t:'op',v:'<>'}`，而非各自被拆成兩個單字元 op
- **AND** 保留字 `AND`、`OR`、`NOT`、`MOD` 必須以 `{t:'op'}` 而非 `{t:'id'}` 呈現

#### Scenario: 識別字一律轉大寫

- **WHEN** 輸入 `print abc`
- **THEN** 兩個 identifier token 的 `v` 分別是 `'PRINT'` 與 `'ABC'`

#### Scenario: 不合法字元拋出 SYNTAX ERROR

- **WHEN** 輸入字串包含 `@`、`#`、`!` 等未支援字元
- **THEN** tokenizer 拋出 `Error('SYNTAX ERROR')`

### Requirement: 運算式 parser 與優先序

The system SHALL parse arithmetic / comparison / logical / function-call expressions following standard precedence: parentheses > unary > power (`^`) > `* / MOD` > `+ -` > comparison > NOT > AND > OR.

#### Scenario: 標準運算優先序

- **WHEN** 解析 `1 + 2 * 3`
- **THEN** 求值結果為 `7`（而非 `9`）

#### Scenario: 冪次右結合或可重複展開

- **WHEN** 解析 `2 ^ 3 ^ 2`
- **THEN** 不論 left- 或 right-associative，求值結果必為 `Math.pow` 的有限值且不拋例外

#### Scenario: 一元負號

- **WHEN** 求值 `-3 + 5`
- **THEN** 結果為 `2`

#### Scenario: 函式呼叫

- **WHEN** 求值 `INT(3.7) + ABS(-2)`
- **THEN** 結果為 `5`

### Requirement: 內建函式

The system SHALL provide the following built-in functions with semantics matching JavaScript-host conventions: `ABS`, `INT`, `SQR`, `SIN`, `COS`, `TAN`, `RND`, `LEN`, `CHR$`, `ASC`, `STR$`, `VAL`, `LEFT$`, `RIGHT$`, `MID$`.

#### Scenario: 數值函式

- **WHEN** 求值
- **THEN**
  - `ABS(-5)` 結果為 `5`
  - `INT(3.7)` 結果為 `3`（floor）
  - `SQR(9)` 結果為 `3`
  - `RND()` 結果落於 `[0, 1)`

#### Scenario: 字串函式

- **WHEN** 求值
- **THEN**
  - `LEN("ABC")` 結果為 `3`
  - `CHR$(65)` 結果為 `"A"`
  - `ASC("A")` 結果為 `65`
  - `LEFT$("HELLO", 3)` 結果為 `"HEL"`
  - `RIGHT$("HELLO", 2)` 結果為 `"LO"`
  - `MID$("HELLO", 2, 3)` 結果為 `"ELL"`（1-indexed 起點，第二參數為長度）
  - `STR$(42)` 結果為 `"42"`、`VAL("3.14")` 結果為 `3.14`、`VAL("X")` 結果為 `0`

#### Scenario: 未定義函式回報 UNDEF FN

- **WHEN** 程式呼叫 `FOO(1)` 而 FOO 不在 FUNCS 內
- **THEN** 拋出 `Error('UNDEF FN FOO')`

### Requirement: 比較與布林（BASIC 約定 -1 為真、0 為假）

The system SHALL evaluate comparison operators `=`, `<>`, `<`, `>`, `<=`, `>=` and logical operators `AND`, `OR`, `NOT` returning `-1` for true and `0` for false.

#### Scenario: 比較回 -1 / 0

- **WHEN** 求值 `5 = 5`、`5 < 3`、`"A" = "A"`
- **THEN** 結果分別為 `-1`、`0`、`-1`

#### Scenario: AND / OR / NOT

- **WHEN** 求值
- **THEN**
  - `1 AND 1` 結果為 `-1`
  - `0 OR 0` 結果為 `0`
  - `NOT 0` 結果為 `-1`、`NOT 1` 結果為 `0`

### Requirement: PRINT 語句

The system SHALL implement `PRINT` (alias `?`) supporting expressions separated by `,` (tab) or `;` (no separator), and a trailing separator suppresses the newline.

#### Scenario: 預設加換行

- **WHEN** 執行 `PRINT "HELLO"`
- **THEN** io.print 收到 `HELLO\n`（自動加換行）

#### Scenario: 逗號分隔以 \t 連接

- **WHEN** 執行 `PRINT 1, 2, 3`
- **THEN** io.print 收到 `1\t2\t3\n`

#### Scenario: 分號結尾抑制換行

- **WHEN** 執行 `PRINT 5;`
- **THEN** io.print 收到 `5`（無換行）

#### Scenario: 數字格式化

- **WHEN** PRINT 整數
- **THEN** 輸出無小數點（`PRINT 3` → `3\n`）
- **WHEN** PRINT 浮點數
- **THEN** 輸出至多 6 位小數且去除尾端 0（`PRINT 1/3` 輸出形如 `0.333333\n`）

### Requirement: INPUT 語句

The system SHALL implement `INPUT [prompt;] var` that displays an optional prompt and resolves asynchronously with user input.

#### Scenario: 無 prompt 使用預設 `? `

- **WHEN** 執行 `INPUT X`
- **THEN** 螢幕顯示 `? ` 提示，並等待使用者輸入；數字字串以 `parseFloat`（失敗時 0）寫入 `X`

#### Scenario: 字串變數（`$` 結尾）保留原文

- **WHEN** 執行 `INPUT N$` 且使用者輸入 `ALICE`
- **THEN** `env.vars.N$` 等於字串 `"ALICE"`，不做數值轉換

#### Scenario: 自訂 prompt

- **WHEN** 執行 `INPUT "AGE: "; A`
- **THEN** 螢幕先顯示 `AGE: `，再等待輸入

### Requirement: 賦值（LET 與隱式賦值）

The system SHALL accept assignments in the forms `LET <var> = <expr>` and `<var> = <expr>` (LET keyword optional).

#### Scenario: 顯式 LET 與隱式賦值等價

- **WHEN** 執行 `LET A = 1` 與 `B = 2`
- **THEN** `env.vars.A === 1` 且 `env.vars.B === 2`

#### Scenario: 未宣告變數預設值

- **WHEN** 變數 `Z` 在尚未賦值時被讀取
- **THEN** 數值變數預設為 `0`、字串變數（`$` 結尾）預設為 `""`

### Requirement: 控制流程（GOTO / IF…THEN…ELSE / GOSUB / RETURN）

The system SHALL support unconditional jumps, conditional execution, and subroutine call/return semantics.

#### Scenario: GOTO 跳轉到指定行號

- **WHEN** 程式執行 `GOTO 30` 而 30 行存在
- **THEN** 程式 counter 跳到該行，繼續執行
- **WHEN** 跳轉到不存在的行號
- **THEN** 輸出 `UNDEF LINE <n>\n` 並終止程式

#### Scenario: IF…THEN…ELSE

- **WHEN** 執行 `IF X = 5 THEN PRINT "OK" ELSE PRINT "NO"`
- **THEN** 條件為真執行 THEN 分支，為假執行 ELSE 分支
- **WHEN** THEN 分支只是行號（如 `IF X > 0 THEN 100`）
- **THEN** 視為 GOTO 100

#### Scenario: GOSUB / RETURN

- **WHEN** 執行 `GOSUB 200`
- **THEN** 將當前行號 push 至 gosub stack，跳到 200 行
- **WHEN** RETURN 執行
- **THEN** pop stack 取得返回行號 R，從 R+1 行開始繼續執行
- **WHEN** RETURN 時 stack 為空
- **THEN** 拋出 `RETURN WITHOUT GOSUB`

### Requirement: FOR / NEXT 迴圈

The system SHALL support `FOR var = start TO end [STEP step]` ... `NEXT` loops with proper start/end/step semantics and stack-based nesting.

#### Scenario: 預設步進為 1

- **WHEN** 執行 `FOR I = 1 TO 5` ... `NEXT I`
- **THEN** 迴圈本體執行 5 次（I = 1, 2, 3, 4, 5）

#### Scenario: 自訂負步進

- **WHEN** 執行 `FOR I = 10 TO 1 STEP -2`
- **THEN** I 取值 10, 8, 6, 4, 2，迴圈執行 5 次

#### Scenario: NEXT 不對應 FOR 拋錯

- **WHEN** 在沒有對應 FOR 的情況下執行 NEXT
- **THEN** 拋出 `NEXT WITHOUT FOR`

### Requirement: 行號式程式儲存與管理

The system SHALL accept lines beginning with a positive integer line number for storage in the in-memory program; entering only a line number SHALL delete that line.

#### Scenario: 新增/取代/刪除程式行

- **WHEN** 立即模式輸入 `10 PRINT "A"`
- **THEN** `env.program[10]` 儲存 `{ text: 'PRINT "A"', tokens: [...] }`
- **WHEN** 再次輸入 `10 PRINT "B"`
- **THEN** `env.program[10]` 被覆寫
- **WHEN** 輸入 `10`（僅行號）
- **THEN** `env.program` 中刪除 key `10`

#### Scenario: LIST 列出程式行

- **WHEN** 執行 `LIST`
- **THEN** 依行號升冪輸出每一行 `<行號> <text>\n`

#### Scenario: NEW 重置程式

- **WHEN** 執行 `NEW`
- **THEN** `env.program`、`env.vars`、`env.forStack`、`env.gosubStack` 全部清空

### Requirement: RUN 執行儲存程式

The system SHALL execute stored program lines in ascending order when `RUN` is invoked, with safety bound and async yield.

#### Scenario: RUN 從最小行號開始

- **WHEN** 執行 `RUN`
- **THEN** 從程式中最小行號依序執行，遇到 `END`/`STOP` 或最後一行後結束
- **WHEN** 程式為空
- **THEN** 輸出 `NO PROGRAM\n` 並結束

#### Scenario: 安全上限 100,000 步

- **WHEN** 程式陷入無窮迴圈
- **THEN** 執行步數達 100,000 後自動結束（防止凍結 UI）

#### Scenario: 每 50 步 yield 一次

- **WHEN** 程式持續執行 50 個 statement
- **THEN** runtime 必須 `await` 一個 0-ms `setTimeout`，讓 UI 有機會更新

#### Scenario: 中斷旗標生效

- **WHEN** 執行期間 `env.aborted` 被設為 true
- **THEN** 當前 statement 完成後立即輸出 `BREAK\n`、將 `env.aborted` 復位為 false 並結束

### Requirement: 錯誤處理與訊息格式

The system SHALL catch exceptions during program execution and report them as `?<message> IN <lineNumber>` to io.print without aborting the host UI.

#### Scenario: 程式行錯誤格式

- **WHEN** 行號 30 執行時拋 `SYNTAX ERROR`
- **THEN** io.print 收到 `?SYNTAX ERROR IN 30\n`，且程式停止

#### Scenario: 立即模式錯誤格式（無行號）

- **WHEN** 立即模式輸入語法錯誤指令
- **THEN** io.print 收到 `?<message>\n`（沒有 ` IN <line>` 後綴）

### Requirement: 雙環境模組匯出

The system SHALL provide `interpreter.js` as a single source that runs both in browser (attaching to `window.IBMTerm`) and in Node (exporting via CommonJS / ESM) so unit tests can import it directly.

#### Scenario: 瀏覽器環境

- **WHEN** 在 HTML 中以 `<script>` 載入
- **THEN** `window.IBMTerm` 提供 `makeBASICEnv`、`execImmediate`、`runProgram`、`evalAPL`、`formatAPL`、`tokenize`

#### Scenario: Node 測試環境

- **WHEN** 測試以 `require('../web/interpreter.js')` 或 ESM `import` 載入
- **THEN** 取得相同 API（`makeBASICEnv` 等），可在沒有 DOM 的環境下單元測試

### Requirement: 磁帶程式來源相容

The system SHALL be able to load all bundled tape sources (HELLO / FIB-12 / PRIME / GUESS / CALC) as a sequence of immediate-mode lines without raising any error other than user-driven `INPUT` requests.

#### Scenario: HELLO tape 執行

- **WHEN** 載入 HELLO 來源並執行 `RUN`
- **THEN** 輸出包含 `HELLO, WORLD.\n` 與 `READY.\n`

#### Scenario: FIB-12 tape 執行

- **WHEN** 載入 FIB-12 來源並執行 `RUN`
- **THEN** 輸出包含 12 行（`I` 與 `B`），第 12 行的 `B` 等於 `144`

#### Scenario: PRIME tape 執行

- **WHEN** 載入 PRIME 來源並執行 `RUN`
- **THEN** 輸出包含 2..50 內所有質數（`2`、`3`、`5`、`7`、`11`、`13`、`17`、`19`、`23`、`29`、`31`、`37`、`41`、`43`、`47`），且尾行為 `READY.\n`
