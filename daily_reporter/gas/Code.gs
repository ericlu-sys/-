/**
 * Daily Reporter - Google Apps Script
 * 只使用「目前選取的工作表」：從對話框選日期後取得 GitHub 資料，報告全部從 B2 寫入。
 *
 * 設定：擴充功能 > Apps Script > 專案設定 > 指令碼內容 新增 GITHUB_TOKEN
 */

var CONFIG = {
  DEFAULT_TZ_OFFSET: 8,
  DEFAULT_REPOS: 'w101-admin/W101-Web,w101-admin/W101-AMS,w101-admin/prd,w101-admin/W101-Admin-Web,w101-admin/W101-TalentSearchHub'
};

/**
 * 開啟「Daily Report 產生器」對話框（選單用）
 */
function showDailyReportDialog() {
  var template = HtmlService.createTemplateFromFile('Dialog');
  template.today = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy-MM-dd');
  var html = template.evaluate().setWidth(640).setHeight(520);
  SpreadsheetApp.getUi().showModalDialog(html, 'Daily Report 產生器');
}

/**
 * 由對話框呼叫：依選定日期取得 GitHub 資料，寫入「目前工作表」從 B3 開始。
 * @param {string} dateStr - 日期 YYYY-MM-DD
 * @return {{ ok: boolean, message: string, prCount?: number, commitCount?: number }}
 */
function fetchGitHubDataForDate(dateStr) {
  var token = getGitHubToken();
  if (!token) {
    return { ok: false, message: '請在 Apps Script 專案設定 > 指令碼內容 新增 GITHUB_TOKEN' };
  }

  dateStr = (dateStr || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { ok: false, message: '請選擇有效日期（YYYY-MM-DD）' };
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (!sheet) {
    return { ok: false, message: '無法取得目前工作表' };
  }

  var tzOffset = CONFIG.DEFAULT_TZ_OFFSET;
  var reposStr = CONFIG.DEFAULT_REPOS;
  var repos = reposStr.split(',').map(function (s) { return s.trim(); }).filter(Boolean);

  var parts = dateStr.split('-');
  var year = parseInt(parts[0], 10);
  var month = parseInt(parts[1], 10) - 1;
  var day = parseInt(parts[2], 10);

  var startUtc = new Date(Date.UTC(year, month, day, -tzOffset, 0, 0));
  var endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
  var sinceParam = formatIsoUtc(startUtc);
  var untilParam = formatIsoUtc(endUtc);

  var allCommits = [];
  var allPrs = [];

  repos.forEach(function (fullName) {
    var pair = fullName.split('/');
    if (pair.length !== 2) return;
    var owner = pair[0].trim();
    var repo = pair[1].trim();
    if (!owner || !repo) return;

    var commits = fetchCommits(owner, repo, token, sinceParam, untilParam);
    commits.forEach(function (c) {
      c.repo = fullName;
      allCommits.push(c);
    });

    var prs = fetchMergedPrsInRange(owner, repo, token, dateStr, addOneDay(dateStr));
    prs.forEach(function (pr) {
      pr.repo = fullName;
      allPrs.push(pr);
    });
  });

  var rows = writeToActiveSheet(sheet, allPrs, allCommits);
  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
  sheet.getRange(1, 2).setValue('執行完畢 ' + timestamp);
  var csv = rowsToCsv(rows);
  return {
    ok: true,
    message: '已寫入目前工作表 B2',
    prCount: allPrs.length,
    commitCount: allCommits.length,
    csv: csv
  };
}

function rowsToCsv(rows) {
  return (rows || []).map(function (row) {
    return (row || []).map(function (cell) {
      var s = String(cell == null ? '' : cell);
      if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0 || s.indexOf('\r') >= 0) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }).join(',');
  }).join('\n');
}

function addOneDay(yyyyMmDd) {
  var d = new Date(yyyyMmDd + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function formatIsoUtc(d) {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function getGitHubToken() {
  return PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN') ||
         PropertiesService.getUserProperties().getProperty('GITHUB_TOKEN');
}

function fetchCommits(owner, repo, token, since, until) {
  var url = 'https://api.github.com/repos/' + owner + '/' + repo + '/commits?since=' + encodeURIComponent(since) + '&until=' + encodeURIComponent(until) + '&per_page=100';
  var options = {
    method: 'get',
    headers: {
      'Authorization': 'token ' + token,
      'Accept': 'application/vnd.github.v3+json'
    },
    muteHttpExceptions: true
  };
  var resp = UrlFetchApp.fetch(url, options);
  if (resp.getResponseCode() !== 200) {
    Logger.log('Commits ' + owner + '/' + repo + ' failed: ' + resp.getContentText());
    return [];
  }
  var data = JSON.parse(resp.getContentText());
  var sinceTime = new Date(since).getTime();
  var untilTime = new Date(until).getTime();
  return data.map(function (c) {
    var author = (c.commit && c.commit.author) ? c.commit.author.name : (c.author ? c.author.login : '');
    var dateStr = (c.commit && c.commit.author && c.commit.author.date) ? c.commit.author.date : '';
    var msg = (c.commit && c.commit.message) ? c.commit.message.split('\n')[0].trim() : '';
    return {
      type: 'Commit',
      repo: owner + '/' + repo,
      title: msg,
      author: author,
      date: dateStr,
      sha: c.sha ? c.sha.substring(0, 7) : '',
      url: c.html_url || ''
    };
  }).filter(function (c) {
    if (!c.date) return false;
    var t = new Date(c.date).getTime();
    return t >= sinceTime && t < untilTime;
  });
}

function fetchMergedPrsInRange(owner, repo, token, startDate, endDate) {
  var q = 'repo:' + owner + '/' + repo + ' is:pr is:merged merged:' + startDate + '..' + endDate;
  var url = 'https://api.github.com/search/issues?q=' + encodeURIComponent(q) + '&per_page=100';
  var options = {
    method: 'get',
    headers: {
      'Authorization': 'token ' + token,
      'Accept': 'application/vnd.github.v3+json'
    },
    muteHttpExceptions: true
  };
  var resp = UrlFetchApp.fetch(url, options);
  if (resp.getResponseCode() !== 200) {
    Logger.log('Search PRs ' + owner + '/' + repo + ' failed: ' + resp.getContentText());
    return [];
  }
  var data = JSON.parse(resp.getContentText());
  var items = data.items || [];
  return items.map(function (pr) {
    return {
      type: 'PR',
      repo: owner + '/' + repo,
      title: pr.title || '',
      author: pr.user ? pr.user.login : '',
      date: pr.merged_at || pr.updated_at || '',
      number: pr.number,
      url: pr.html_url || ''
    };
  });
}

function writeToActiveSheet(sheet, prs, commits) {
  var rows = [];
  rows.push(['類型', 'Repo', '標題/訊息', '作者', '時間', '編號/SHA', '連結']);
  prs.forEach(function (p) {
    rows.push(['PR', p.repo, p.title, p.author, p.date, p.number ? '#' + p.number : '', p.url || '']);
  });
  commits.forEach(function (c) {
    rows.push(['Commit', c.repo, c.title, c.author, c.date, c.sha || '', c.url || '']);
  });

  if (rows.length === 0) return [];
  var numRows = rows.length;
  var numCols = 7;
  sheet.getRange(2, 2, numRows, numCols).setValues(rows);
  sheet.getRange(2, 2, 1, numCols).setFontWeight('bold');
  sheet.autoResizeColumns(2, 8);
  var endRow = 2 + numRows - 1;
  var lastRow = sheet.getLastRow();
  if (lastRow > endRow) {
    sheet.getRange(endRow + 1, 2, lastRow - endRow, numCols).clearContent();
  }
  return rows;
}

/**
 * 選單：擴充功能底下出現「Daily Report」→「Daily Report 產生器」
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Daily Report')
    .addItem('Daily Report 產生器', 'showDailyReportDialog')
    .addToUi();
}
