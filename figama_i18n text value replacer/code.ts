figma.showUI(__html__, { width: 340, height: 500, themeColors: true });

// 翻譯表改為在「載入資料」時傳入並存於 plugin，執行替換只傳 targetLocale，避免單次 postMessage 過大導致收不到
let storedPathToLocales: Record<string, Record<string, string>> | null = null;

// i18n 測試：20 個較長假文，模擬越南文／泰文／俄文等翻譯後字數變長
const RANDOM_I18N_VALUE: string[] = [
  'whkh sasddh ads m ada lorem ipsum dolor sit amet consectetur !',
  'kdfj alsk qwe zxc mnb the quick brown fox jumps over the lazy dog .',
  'xq mwp vn e rtl pqs kdw mxn c vbz lorem ipsum dolor sit amet !',
  'pqs kdw mxn c vbz xq mwp vn e rtl consectetur adipiscing elit sed .',
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod',
  'the quick brown fox jumps over the lazy dog and runs into the forest',
  'wkh sddh as m ada whkh sasddh ads m ada lorem ipsum dolor sit !',
  'vn e rtl pqs kdw mxn zxc mnb kdfj alsk qwe tempor incididunt ut labore',
  'zxc mnb kdfj alsk qwe vn e rtl pqs kdw mxn c vbz dolore magna aliqua',
  'dolor sit lorem ipsum amet consectetur adipiscing elit sed do eiusmod',
  'brwn fx jmps the qick over the lazy dog and runs into the forest now',
  'mxn c vbz xq mwp vn e rtl pqs kdw lorem ipsum dolor sit amet consectetur',
  'ads m ada whkh sasddh lorem ipsum dolor sit amet consectetur adipiscing',
  'qwe zxc mnb kdfj alsk tempor incididunt ut labore et dolore magna aliqua',
  'e rtl ! pqs kdw mxn c vbz xq mwp vn lorem ipsum dolor sit amet !',
  'ipsum dolor sit lorem amet consectetur adipiscing elit sed do eiusmod tempor',
  'qick brwn fx jmps the lazy dog over the fence and runs into the forest',
  'sasddh ads m ada whkh lorem ipsum dolor sit amet consectetur adipiscing elit',
  'alsk qwe zxc mnb kdfj vn e rtl pqs kdw mxn ut labore et dolore magna',
  'mwpn vn e rtl pqs kd xq mwp vn e rtl lorem ipsum dolor sit amet !'
];

figma.ui.onmessage = async (msg) => {
  const selection = figma.currentPage.selection;

  if (msg.type === 'set-pathToLocales') {
    storedPathToLocales = (msg.pathToLocales as Record<string, Record<string, string>>) || null;
    figma.ui.postMessage({ type: 'i18n-result', code: 'DATA_STORED', message: '翻譯表已存入外掛' });
    return;
  }

  // --- 功能 1: i18n 翻譯（依文字內容替換，不管 key／圖層名）---
  if (msg.type === 'run-i18n-by-text') {
    figma.ui.postMessage({ type: 'i18n-start', selectionCount: selection.length });
    if (selection.length === 0) {
      figma.notify("⚠️ 請先選取範圍");
      figma.ui.postMessage({ type: 'i18n-result', code: 'NO_SELECTION', message: '請先選取範圍' });
      return;
    }

    const pathToLocales = (msg.pathToLocales as Record<string, Record<string, string>>) || storedPathToLocales;
    const targetLocale = msg.targetLocale as string;
    if (!pathToLocales || !targetLocale) {
      figma.notify("⚠️ 缺少替換資料");
      figma.ui.postMessage({
        type: 'i18n-result',
        code: 'MISSING_DATA',
        message: '缺少替換資料。請先按「載入資料」；若已載入仍出現此訊息，可能是翻譯表過大，請重新開啟外掛再試。'
      });
      return;
    }

    // 查詢方式：(1) 語系欄 zh-TW / en-US / vi-VN / th-TH / id-ID 的值 = 目前文字 → 取得該列，用目標語系替換
    //         (2) key 欄 = 目前文字 → 取得該列，用目標語系替換
    function findReplacement(currentText: string): string | null {
      const trimmed = currentText.trim();
      // 1) 依「目前文字 = 某語系欄位的值」找到該列 (path)，再取該列的 targetLocale 值
      for (const path of Object.keys(pathToLocales)) {
        const byLocale = pathToLocales[path];
        for (const loc of Object.keys(byLocale)) {
          if (String(byLocale[loc]).trim() === trimmed) {
            const replacement = byLocale[targetLocale];
            return replacement != null ? String(replacement) : null;
          }
        }
      }
      // 2) 依「目前文字 = key 欄」查表，取得該列後用目標語系替換
      const byLocale = pathToLocales[trimmed];
      if (byLocale && byLocale[targetLocale] != null) return String(byLocale[targetLocale]);
      return null;
    }

    const notFoundValues: string[] = [];
    let count = 0;
    // 只替換文字內容 (characters)，不更動圖層名稱，故可遍歷所有子節點（含 Component/Instance 內文字）
    async function processByText(node: SceneNode) {
      if (node.type === "TEXT") {
        const text = (node as TextNode).characters;
        const replacement = findReplacement(text);
        if (replacement != null) {
          const tn = node as TextNode;
          const font = tn.fontName;
          if (typeof font === "object" && font && "family" in font) {
            await figma.loadFontAsync(font);
          } else if (tn.characters.length > 0) {
            const fonts = tn.getRangeAllFontNames(0, 1);
            if (fonts && fonts.length > 0) await figma.loadFontAsync(fonts[0]);
          }
          tn.characters = replacement;
          count++;
        } else if (text.trim().length > 0) {
          const t = text.trim();
          if (notFoundValues.indexOf(t) === -1) notFoundValues.push(t);
        }
      }
      if ("children" in node && node.children) {
        for (const child of node.children) await processByText(child);
      }
    }

    try {
      for (const node of selection) await processByText(node);
      const code = count > 0 ? 'SUCCESS' : (notFoundValues.length > 0 ? 'NOT_FOUND' : 'ZERO_REPLACED');
      let message = count > 0
        ? `替換完成：已將 ${count} 個文字改為 ${targetLocale}`
        : notFoundValues.length > 0
          ? `找不到以下文字的對應翻譯：${notFoundValues.slice(0, 10).join('、')}${notFoundValues.length > 10 ? `… 共 ${notFoundValues.length} 則` : ''}`
          : '選取範圍內沒有可替換的文字（或目標語系無值）';
      figma.notify(count > 0 ? `✅ ${message}` : `⚠️ ${message}`);
      figma.ui.postMessage({ type: 'i18n-result', code, message, count, notFoundValues });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      figma.notify(`❌ 替換失敗：${errMsg}`);
      figma.ui.postMessage({ type: 'i18n-result', code: 'ERROR', message: errMsg });
    }
  }

  // --- 功能 2: 同步圖層名 (修正版：嚴格跳過 Instance) ---
  if (msg.type === 'sync-names') {
    if (selection.length === 0) return figma.notify("⚠️ 請先選取物件");

    let updatedCount = 0;
    function processSync(node: any) {
      // 1. 如果是 Instance，直接停止，不處理它也不處理它的子層
      if (node.type === "INSTANCE") return;

      // 2. 只有非組件的普通文字才同步
      if (node.type === "TEXT") {
        const content = node.characters.trim();
        if (content.length > 0 && node.name !== content) {
          node.name = content;
          updatedCount++;
        }
      }

      if (node.children && node.type !== "COMPONENT_SET") {
        for (const child of node.children) processSync(child);
      }
    }

    for (const node of selection) processSync(node);
    
    // 強制通知 UI 進度完成
    figma.ui.postMessage({ type: 'update-progress', current: 1, total: 1 });
    figma.notify(`✅ 同步完成：更新了 ${updatedCount} 個普通圖層名`);
  }

  // --- 功能 3: i18n 測試（替換為假文，還原請用 Ctrl+Z / Cmd+Z）---
  if (msg.type === 'run-i18n-test') {
    if (selection.length === 0) {
      figma.notify("⚠️ 請先選取範圍");
      figma.ui.postMessage({ type: 'i18n-test-no-selection' });
      return;
    }
    const seen = new Set<string>();
    const textNodes: TextNode[] = [];
    for (const n of selection) {
      if (n.type === "TEXT" && !seen.has(n.id)) {
        seen.add(n.id);
        textNodes.push(n as TextNode);
      }
      const finder = (n as { findAll?: (pred: (node: SceneNode) => boolean) => SceneNode[] }).findAll;
      if (typeof finder === "function") {
        const found = finder.call(n, (c) => c.type === "TEXT");
        for (const c of found) {
          if (!seen.has(c.id)) {
            seen.add(c.id);
            textNodes.push(c as TextNode);
          }
        }
      }
    }
    let count = 0;
    const pickRandom = () => RANDOM_I18N_VALUE[Math.floor(Math.random() * RANDOM_I18N_VALUE.length)];
    for (const tn of textNodes) {
      const replacement = pickRandom();
      const font = tn.fontName;
      if (typeof font === "object" && font && "family" in font) {
        await figma.loadFontAsync(font);
      } else if (tn.characters.length > 0) {
        const fonts = tn.getRangeAllFontNames(0, 1);
        if (fonts && fonts.length > 0) await figma.loadFontAsync(fonts[0]);
      }
      tn.characters = replacement;
      count++;
    }
    figma.notify(count > 0 ? `✅ i18n 測試：已替換 ${count} 個文字` : "⚠️ 選取範圍內沒有文字圖層");
    figma.ui.postMessage({ type: 'i18n-test-done', count });
  }
};