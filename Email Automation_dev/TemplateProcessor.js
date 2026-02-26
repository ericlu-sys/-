/**
 * 將字串編碼成 HTML 實體 
 * @param value {string} - 要編碼的字串 
 * @returns {string} - 編碼後的字串 
 */
function htmlEncode(value) {
  if (!value) return '';
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 替換範本中的參數
 * @param template {string} - 範本字串
 * @param replacements {object} - 參數對應表
 * @returns {string} - 替換後的字串
 */
function replacePlaceholders(template, replacements) {
  let result = decodeHtml(template);

  for (const [key, value] of Object.entries(replacements)) {
    const encodedValue = htmlEncode(value); // 編碼參數值
    const regex = new RegExp(`<<${key}>>`, 'g');
    result = result.replace(regex, encodedValue);
  }

  return result;
}

/**
 * 將 HTML 實體解碼成字串 
 * @param html {string} - 要解碼的 HTML 實體 
 * @returns {string} - 解碼後的字串 
 */
function decodeHtml(html) {
  return html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}