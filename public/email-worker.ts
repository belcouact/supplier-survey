/// <reference types="@cloudflare/workers-types" />

export interface Env {
  EMAIL_JOBS: KVNamespace;
  RESEND_API_KEY: string;
  SUPABASE_SERVICE_KEY: string;
  SUPABASE_URL?: string;
}

const SUPABASE_PROJECT_ID = 'sellervptovbxfzkldtz';

const getSupabaseRestUrl = (env: Env) => {
  const base =
    env.SUPABASE_URL && env.SUPABASE_URL.trim().length > 0
      ? env.SUPABASE_URL.trim()
      : `https://${SUPABASE_PROJECT_ID}.supabase.co`;
  return `${base}/rest/v1`;
};

const getSupabaseHeaders = (env: Env, contentType?: string): Record<string, string> => {
  const key = env.SUPABASE_SERVICE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_KEY is not configured');
  }
  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  return headers;
};

const mapJobToRow = (job: ScheduledEmailJob) => ({
  id: job.id,
  user_id: job.userId,
  recipients: job.recipients,
  subject: job.subject,
  body: job.body,
  body_html: job.bodyHtml ?? null,
  send_at: job.sendAt,
  sent: job.sent,
  mode: job.mode ?? null,
  ai_model: job.aiModel ?? null,
  from_name: job.fromName ?? null,
  recurring: job.recurring === true,
});

const mapRowToJob = (row: any): ScheduledEmailJob => ({
  id: row.id,
  userId: row.user_id ?? null,
  recipients: Array.isArray(row.recipients) ? row.recipients : [],
  subject: row.subject || '',
  body: row.body || '',
  bodyHtml: row.body_html ?? undefined,
  sendAt:
    typeof row.send_at === 'number'
      ? row.send_at
      : Date.parse(row.send_at || ''),
  sent: !!row.sent,
  mode:
    row.mode === 'autoSummary'
      ? 'autoSummary'
      : row.mode === 'manual'
      ? 'manual'
      : undefined,
  aiModel: row.ai_model ?? undefined,
  fromName: row.from_name ?? undefined,
  recurring: row.recurring === true,
});

interface ScheduledEmailJob {
  id: string;
  userId: string | null;
  recipients: string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  sendAt: number;
  sent: boolean;
  mode?: 'manual' | 'autoSummary';
  aiModel?: string;
  fromName?: string;
  recurring?: boolean;
}

interface GroupPerformanceRow {
  groupName: string;
  metricId: string;
  metricName: string;
  bowlerId: string;
  latestMet: boolean | null;
  latestActual: string | null;
  fail2: boolean;
  fail3: boolean;
  achievementRate: number | null;
  linkedA3Count: number;
}

const isViolation = (
  rule: 'gte' | 'lte' | 'within_range' | undefined,
  targetStr: string | undefined,
  actualStr: string | undefined,
): boolean => {
  if (!actualStr || !targetStr) return false;

  const actual = parseFloat(actualStr);
  if (isNaN(actual)) return false;

  const effectiveRule = rule || 'gte';

  if (effectiveRule === 'gte') {
    const target = parseFloat(targetStr);
    if (isNaN(target)) return false;
    return actual < target;
  }

  if (effectiveRule === 'lte') {
    const target = parseFloat(targetStr);
    if (isNaN(target)) return false;
    return actual > target;
  }

  if (effectiveRule === 'within_range') {
    const match = targetStr.match(/^(?:\{|\[)?\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*(?:\}|\])?$/);
    if (match) {
      const min = parseFloat(match[1]);
      const max = parseFloat(match[2]);
      if (!isNaN(min) && !isNaN(max)) {
        return actual < min || actual > max;
      }
    }
  }

  return false;
};

const computeGroupPerformanceTableData = (
  bowlers: any[],
  a3Cases: any[],
): GroupPerformanceRow[] => {
  const groupToMetrics: Record<string, any[]> = {};
  const metricOwnerById: Record<string, string> = {};

  bowlers.forEach(bowler => {
    const groupName = (bowler.group || 'Ungrouped').trim() || 'Ungrouped';
    const metrics = bowler.metrics || [];

    metrics.forEach((metric: any) => {
      if (!metric || !metric.monthlyData || Object.keys(metric.monthlyData).length === 0) {
        return;
      }

      metricOwnerById[metric.id] = bowler.id;

      if (!groupToMetrics[groupName]) {
        groupToMetrics[groupName] = [];
      }
      groupToMetrics[groupName].push(metric);
    });
  });

  const groupNames = Object.keys(groupToMetrics).sort();

  if (groupNames.length === 0) return [];

  const rows: GroupPerformanceRow[] = [];

  const isValuePresent = (value: unknown) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim() !== '';
    return true;
  };

  const hasDataAndTarget = (data: { actual?: unknown; target?: unknown } | undefined) =>
    !!data && isValuePresent(data.actual) && isValuePresent(data.target);

  groupNames.forEach(groupName => {
    const metrics = groupToMetrics[groupName] || [];

    metrics.forEach(metric => {
      const monthly = metric.monthlyData || {};
      const months = Object.keys(monthly)
        .filter(month => {
          const data = monthly[month];
          return hasDataAndTarget(data);
        })
        .sort();

      let latestMet: boolean | null = null;
      let latestActual: string | null = null;
      let fail2 = false;
      let fail3 = false;
      let achievementRate: number | null = null;
      let linkedA3Count = 0;

      if (months.length > 0) {
        const latestMonth = months[months.length - 1];
        const latest2Months = months.slice(-2);
        const latest3Months = months.slice(-3);

        const latestData = monthly[latestMonth];
        if (hasDataAndTarget(latestData)) {
          latestMet = !isViolation(
            metric.targetMeetingRule,
            latestData.target as string | undefined,
            latestData.actual as string | undefined,
          );
          latestActual = `${latestData.actual as string}`;
        }

        if (latest2Months.length === 2) {
          let allFail2 = true;
          for (const month of latest2Months) {
            const data = monthly[month];
            if (
              !hasDataAndTarget(data) ||
              !isViolation(
                metric.targetMeetingRule,
                data.target as string | undefined,
                data.actual as string | undefined,
              )
            ) {
              allFail2 = false;
              break;
            }
          }
          fail2 = allFail2;
        }

        if (latest3Months.length === 3) {
          let allFail3 = true;
          for (const month of latest3Months) {
            const data = monthly[month];
            if (
              !hasDataAndTarget(data) ||
              !isViolation(
                metric.targetMeetingRule,
                data.target as string | undefined,
                data.actual as string | undefined,
              )
            ) {
              allFail3 = false;
              break;
            }
          }
          fail3 = allFail3;
        }

        let totalPoints = 0;
        let metPoints = 0;
        months.forEach(month => {
          const data = monthly[month];
          if (!hasDataAndTarget(data)) return;
          totalPoints += 1;
          const violation = isViolation(
            metric.targetMeetingRule,
            data.target as string | undefined,
            data.actual as string | undefined,
          );
          if (!violation) {
            metPoints += 1;
          }
        });

        achievementRate = totalPoints > 0 ? (metPoints / totalPoints) * 100 : null;

        const isAtRisk = fail2 || fail3;
        if (isAtRisk) {
          linkedA3Count = a3Cases.filter((c: any) =>
            (c.linkedMetricIds || []).includes(metric.id),
          ).length;
        }
      }

      rows.push({
        groupName,
        metricId: metric.id,
        metricName: metric.name,
        bowlerId: metricOwnerById[metric.id],
        latestMet,
        latestActual,
        fail2,
        fail3,
        achievementRate,
        linkedA3Count,
      });
    });
  });

  return rows;
};

const buildEmailSummaryForRows = (raw: string, rows: GroupPerformanceRow[]): string => {
  try {
    const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean) as {
      executiveSummary?: string;
      a3Summary?: string;
      areasOfConcern?: {
        metricName: string;
        groupName: string;
        issue: string;
        suggestion: string;
      }[];
    };

    if (!parsed || !parsed.executiveSummary) {
      return raw;
    }

    let text = `Executive Overview:\n${parsed.executiveSummary}\n\n`;

    if (parsed.a3Summary && parsed.a3Summary.trim() !== '') {
      text += `A3 Problem Solving Summary:\n${parsed.a3Summary}\n\n`;
    }

    if (rows.length > 0) {
      text += 'Portfolio Statistical Table:\n';
      text +=
        'Group | Metric | Latest month | Last 2 months | Last 3 months | Linked A3s | Overall target achieving %\n';
      text +=
        '----- | ------ | ------------ | ------------- | ------------- | ---------- | --------------------------\n';

      rows.forEach(row => {
        const latestText =
          row.latestMet === null || !row.latestActual ? '—' : row.latestActual;

        const last2Text = row.fail2 ? 'Failing' : '—';
        const last3Text = row.fail3 ? 'Failing' : '—';

        const atRisk = row.fail2 || row.fail3;
        const linkedText = atRisk
          ? row.linkedA3Count === 0
            ? '0'
            : String(row.linkedA3Count)
          : '—';

        const achievementText =
          row.achievementRate != null ? `${row.achievementRate.toFixed(0)}%` : '—';

        text += `${row.groupName} | ${row.metricName} | ${latestText} | ${last2Text} | ${last3Text} | ${linkedText} | ${achievementText}\n`;
      });

      text += '\n';
    }

    if (Array.isArray(parsed.areasOfConcern) && parsed.areasOfConcern.length > 0) {
      text += 'Areas of Concern & Recommendations:\n';
      parsed.areasOfConcern.forEach(area => {
        text += `- ${area.metricName} (${area.groupName}): ${area.issue}\n  Suggestion: ${area.suggestion}\n`;
      });
    }

    return text;
  } catch {
    return raw;
  }
};

const buildEmailHtmlForRows = (raw: string, rows: GroupPerformanceRow[]): string => {
  try {
    const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean) as {
      executiveSummary?: string;
      a3Summary?: string;
      areasOfConcern?: {
        metricName: string;
        groupName: string;
        issue: string;
        suggestion: string;
      }[];
    };

    if (!parsed || !parsed.executiveSummary || !Array.isArray(parsed.areasOfConcern)) {
      return '';
    }

    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const executive = escapeHtml(parsed.executiveSummary);
    const a3Summary =
      parsed.a3Summary && parsed.a3Summary.trim() !== ''
        ? `<section class="card card-a3">
  <h2 class="card-title">A3 Problem Solving Summary</h2>
  <p>${escapeHtml(parsed.a3Summary)}</p>
</section>`
        : '';

    const statsTableHtml =
      rows.length > 0
        ? `<section class="card card-stats">
  <h2 class="card-title">Portfolio Statistical Table</h2>
  <div class="table-wrapper">
    <table class="stats-table">
      <thead>
        <tr>
          <th>Group</th>
          <th>Metric</th>
          <th>Latest month</th>
          <th>Last 2 months</th>
          <th>Last 3 months</th>
          <th>Linked A3s</th>
          <th>Overall target achieving %</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            row => `<tr>
          <td>${escapeHtml(row.groupName)}</td>
          <td>${escapeHtml(row.metricName)}</td>
          <td>${
            row.latestMet === null || !row.latestActual
              ? '—'
              : `<span class="status-pill ${
                  row.latestMet === false ? 'status-fail' : 'status-ok'
                }">${escapeHtml(row.latestActual)}</span>`
          }</td>
          <td>${
            row.fail2
              ? '<span class="status-pill status-warn"><span class="status-dot"></span>Failing</span>'
              : '—'
          }</td>
          <td>${
            row.fail3
              ? '<span class="status-pill status-fail"><span class="status-dot"></span>Failing</span>'
              : '—'
          }</td>
          <td>${
            row.fail2 || row.fail3
              ? row.linkedA3Count === 0
                ? '<span class="circle-badge circle-badge-fail">0</span>'
                : `<span class="circle-badge circle-badge-ok">${row.linkedA3Count}</span>`
              : '—'
          }</td>
          <td>${
            row.achievementRate != null
              ? `<span class="status-pill ${
                  row.achievementRate < (2 / 3) * 100
                    ? 'status-fail'
                    : 'status-ok'
                }">${row.achievementRate.toFixed(0)}%</span>`
              : '—'
          }</td>
        </tr>`,
          )
          .join('')}
      </tbody>
    </table>
  </div>
</section>`
        : '';

    const concernsHtml =
      parsed.areasOfConcern.length > 0
        ? parsed.areasOfConcern
            .map(
              area => `<div class="concern-card">
  <div class="concern-header">
    <span class="concern-metric">${escapeHtml(area.metricName)}</span>
    <span class="concern-group">${escapeHtml(area.groupName)}</span>
  </div>
  <p class="concern-issue">${escapeHtml(area.issue)}</p>
  <p class="concern-suggestion">${escapeHtml(area.suggestion)}</p>
</div>`,
            )
            .join('')
        : '<p class="empty-text">No major areas of concern identified. Keep up the good work!</p>';

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Smart Summary & Insights</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root {
      --bg: #f3f4f6;
      --card-bg: #ffffff;
      --primary: #4f46e5;
      --primary-soft: #eef2ff;
      --border-subtle: #e5e7eb;
      --text-main: #111827;
      --text-muted: #6b7280;
      --danger: #b91c1c;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      background: var(--bg);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--text-main);
    }
    .summary-root {
      max-width: 1100px;
      margin: 0 auto;
    }
    .summary-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-radius: 16px;
      background: linear-gradient(90deg, #eef2ff, #ffffff);
      border: 1px solid #e0e7ff;
      margin-bottom: 20px;
    }
    .summary-title {
      font-size: 18px;
      font-weight: 700;
      margin: 0;
    }
    .summary-tag {
      display: inline-flex;
      align-items: center;
      padding: 4px 8px;
      border-radius: 999px;
      background: #ecfdf3;
      color: #166534;
      border: 1px solid #bbf7d0;
      font-size: 11px;
      font-weight: 500;
      margin-top: 4px;
    }
    .summary-tag span {
      margin-left: 4px;
    }
    .card {
      background: var(--card-bg);
      border-radius: 16px;
      border: 1px solid var(--border-subtle);
      padding: 20px 24px;
      margin-bottom: 20px;
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.05);
    }
    .card-executive {
      background: linear-gradient(135deg, #eef2ff, #ffffff);
      border-color: #e0e7ff;
    }
    .card-a3 {
      background: linear-gradient(135deg, #eff6ff, #ffffff);
      border-color: #bfdbfe;
    }
    .card-title {
      margin: 0 0 12px 0;
      font-size: 16px;
      font-weight: 700;
      color: var(--primary);
    }
    .card p {
      margin: 0;
      font-size: 14px;
      line-height: 1.6;
      color: var(--text-muted);
    }
    .card-concerns {
      background: #fef2f2;
      border-color: #fecaca;
    }
    .concern-card {
      background: #ffffff;
      border-radius: 12px;
      border: 1px solid #fee2e2;
      padding: 12px 14px;
      margin-bottom: 10px;
    }
    .concern-header {
      display: flex;
      align-items: center;
      margin-bottom: 6px;
    }
    .concern-metric {
      font-size: 13px;
      font-weight: 700;
      margin-right: 6px;
      color: #111827;
    }
    .concern-group {
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 999px;
      background: #f3f4f6;
      color: #4b5563;
    }
    .concern-issue {
      font-size: 13px;
      color: var(--danger);
      font-weight: 500;
      margin: 0 0 4px 0;
    }
    .concern-suggestion {
      font-size: 13px;
      color: #4b5563;
      margin: 0;
      font-style: italic;
    }
    .empty-text {
      font-size: 13px;
      color: #9ca3af;
      font-style: italic;
    }
    .table-wrapper {
      overflow-x: auto;
      margin-top: 8px;
    }
    .stats-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    .stats-table th,
    .stats-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #e5e7eb;
      text-align: left;
    }
    .stats-table thead th {
      background: #f9fafb;
      font-weight: 600;
      color: #4b5563;
    }
    .status-pill {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 500;
      border: 1px solid transparent;
    }
    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      margin-right: 4px;
      background: currentColor;
    }
    .status-ok {
      background: #ecfdf3;
      color: #166534;
      border-color: #bbf7d0;
    }
    .status-fail {
      background: #fef2f2;
      color: #b91c1c;
      border-color: #fecaca;
    }
    .status-warn {
      background: #fffbeb;
      color: #92400e;
      border-color: #fed7aa;
    }
    .circle-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      border: 1px solid transparent;
    }
    .circle-badge-ok {
      background: #ecfdf3;
      color: #166534;
      border-color: #bbf7d0;
    }
    .circle-badge-fail {
      background: #fef2f2;
      color: #b91c1c;
      border-color: #fecaca;
    }
    @media (max-width: 640px) {
      body { padding: 16px; }
      .summary-header { flex-direction: column; align-items: flex-start; }
    }
  </style>
</head>
<body>
  <div class="summary-root">
    <header class="summary-header">
      <div>
        <h1 class="summary-title">Smart Summary & Insights</h1>
        <div class="summary-tag">
          <span>Consecutive Failing Metrics Focus</span>
        </div>
      </div>
    </header>

    <section class="card card-executive">
      <h2 class="card-title">Executive Overview</h2>
      <p>${executive}</p>
    </section>

    ${statsTableHtml}

    ${a3Summary}

    <section class="card card-concerns">
      <h2 class="card-title">Areas of Concern & Recommendations</h2>
      ${concernsHtml}
    </section>
  </div>
</body>
</html>`;

    return html;
  } catch {
    return '';
  }
};

const createId = (prefix: string, index?: number) => {
  const anyGlobal = globalThis as any;
  if (anyGlobal.crypto && typeof anyGlobal.crypto.randomUUID === 'function') {
    return anyGlobal.crypto.randomUUID();
  }
  const suffix = index != null ? `${Date.now()}-${index}` : `${Date.now()}-${Math.random()}`;
  return `${prefix}-${suffix}`;
};

const sendEmailWithResend = async (env: Env, job: ScheduledEmailJob) => {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('Missing RESEND_API_KEY');
  }

  const rawFromName = (job.fromName || '').trim();
  let fromName = 'study-llm.me';
  if (rawFromName === 'Equipment Fault Manager') {
    fromName = 'Equipment Fault Manager';
  } else if (rawFromName === 'A3 Bowler') {
    fromName = 'A3 Bowler';
  } else if (rawFromName === 'Light Gantt') {
    fromName = 'Light Gantt';
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${fromName} <no-reply@study-llm.me>`,
      to: job.recipients,
      subject: job.subject,
      text: job.body,
      html: job.bodyHtml,
    }),
  });

  if (!response.ok) {
    let bodyText = '';
    try {
      bodyText = await response.text();
    } catch {
      bodyText = '';
    }
    throw new Error(`Resend error: ${response.status} ${response.statusText} ${bodyText}`);
  }
};

const getValidModel = (model?: string | null): string => {
  if (model === 'gemini' || model === 'deepseek' || model === 'kimi' || model === 'glm') {
    return model;
  }
  return 'deepseek';
};

const buildSimpleHtmlFromText = (text: string): string => {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const withBreaks = escaped
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n/g, '<br />');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Monthly A3 / Bowler Summary</title>
</head>
<body>
  <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.6;">
    ${withBreaks}
  </div>
</body>
</html>`;
};

const generateComprehensiveSummary = async (
  context: string,
  prompt: string,
  model: string,
): Promise<string> => {
  try {
    const response = await fetch('https://multi-model-worker.study-llm.me/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: `You are an AI assistant for the Metric Bowler & A3 Problem Solving application. 
            Here is the current data in the application: ${context}.
            Answer the user's questions based on this data. Be concise and helpful.`,
          },
          { role: 'user', content: prompt },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    const data: any = await response.json();
    return (
      (data.choices?.[0]?.message?.content as string | undefined) ||
      (data.choices?.[0]?.delta?.content as string | undefined) ||
      "Sorry, I couldn't generate a response."
    );
  } catch (error) {
    console.error('AI Summary Error:', error);
    return 'Sorry, there was an error generating the summary. Please try again later.';
  }
};

const buildAutoSummaryForJob = async (
  job: ScheduledEmailJob,
): Promise<{ jobToSend: ScheduledEmailJob; dashboardSettings: any | null }> => {
  if (!job.userId) {
    throw new Error('userId is required for auto summary emails');
  }

  const userId = job.userId;
  const response = await fetch(
    `https://bowler-worker.study-llm.me/load?userId=${encodeURIComponent(userId)}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load user data for summary: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as any;
  const bowlers = Array.isArray(data.bowlers) ? data.bowlers : [];
  const a3Cases = Array.isArray(data.a3Cases) ? data.a3Cases : [];
  const dashboardSettings = data.dashboardSettings || null;

  let effectiveBowlers = bowlers;
  let effectiveA3Cases = a3Cases;

  try {
    const consolidateSettings =
      dashboardSettings && typeof dashboardSettings === 'object'
        ? (dashboardSettings as any).emailConsolidate || {}
        : {};

    const consolidateEnabled =
      typeof consolidateSettings.enabled === 'boolean'
        ? consolidateSettings.enabled
        : false;

    if (consolidateEnabled) {
      const rawTags =
        typeof consolidateSettings.tags === 'string' ? consolidateSettings.tags : '';
      const tags = rawTags
        .split(',')
        .map((t: string) => t.trim())
        .filter((t: string) => t.length > 0);

      if (tags.length > 0) {
        const consolidateResponse = await fetch(
          'https://bowler-worker.study-llm.me/consolidate',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ tags }),
          },
        );

        if (consolidateResponse.ok) {
          const consolidateData = (await consolidateResponse.json()) as any;
          if (consolidateData && consolidateData.success) {
            const mergedBowlers = Array.isArray(consolidateData.bowlers)
              ? consolidateData.bowlers
              : [];
            const mergedA3Cases = Array.isArray(consolidateData.a3Cases)
              ? consolidateData.a3Cases
              : [];

            if (mergedBowlers.length > 0 || mergedA3Cases.length > 0) {
              effectiveBowlers = mergedBowlers;
              effectiveA3Cases = mergedA3Cases;
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Consolidation before auto summary failed', error);
  }

  const normalizedBowlers = effectiveBowlers.map((b: any) => ({
    ...b,
    group: b.group || 'Ungrouped',
  }));

  const rows = computeGroupPerformanceTableData(normalizedBowlers, effectiveA3Cases);

  const failingMetricsForAI = rows.filter(row => row.fail2 || row.fail3);

  const statsForPrompt = JSON.stringify(
    failingMetricsForAI.map(row => {
      const linked = effectiveA3Cases.filter((c: any) =>
        (c.linkedMetricIds || []).includes(row.metricId),
      );
      const completedCount = linked.filter(
        (c: any) => (c.status || '').trim().toLowerCase() === 'completed',
      ).length;
      const activeCount = linked.filter(
        (c: any) => (c.status || '').trim().toLowerCase() !== 'completed',
      ).length;

      return {
        groupName: row.groupName,
        metricName: row.metricName,
        metricId: row.metricId,
        latestMet: row.latestMet,
        fail2: row.fail2,
        fail3: row.fail3,
        achievementRate:
          row.achievementRate != null ? Number(row.achievementRate.toFixed(1)) : null,
        linkedA3Total: linked.length,
        linkedA3Completed: completedCount,
        linkedA3Active: activeCount,
      };
    }),
    null,
    2,
  );

  const context = JSON.stringify({
    bowlers: normalizedBowlers,
    a3Cases: effectiveA3Cases.map((c: any) => {
      const clone = { ...c };
      delete (clone as any).mindMapNodes;
      delete (clone as any).dataAnalysisImages;
      delete (clone as any).resultImages;
      delete (clone as any).dataAnalysisCanvasHeight;
      delete (clone as any).resultCanvasHeight;
      return clone;
    }),
  });

  const prompt = `You are generating a one-click portfolio summary focused on improvement opportunities.

Use the pre-computed statistical snapshot below. Do not redo statistical calculations from raw data. Rely on this snapshot instead.

Consecutive failing metrics (derived from the integrated portfolio table):
${statsForPrompt}

Definitions:
- latestMet: null = no data, true = met latest target, false = missed latest target.
- fail2: true if the metric missed its target for the latest 2 consecutive months.
- fail3: true if the metric missed its target for the latest 3 consecutive months.
- achievementRate: percentage of historical data points that met target.
- metricId: unique id of the metric (matches linkedMetricIds in A3 cases from context).
- linkedA3Total: total number of A3 cases linked to this metric.
- linkedA3Completed: number of linked A3s with status "Completed".
- linkedA3Active: number of linked A3s that are not completed.

Tasks:
1) Write "executiveSummary": a concise high-level snapshot of overall portfolio performance across metrics and A3 activity.
2) Write "a3Summary": an overview of the A3 problem-solving portfolio (key themes, progress, coverage, and where A3 work is effective or insufficient).
3) Build "areasOfConcern": each entry must correspond to one metric from the snapshot where fail2 or fail3 is true.
   - For each metric, write a rich, multi-sentence issue description that references consecutive failures, achievementRate, and any linked A3 activity.
   - For each metric, provide a detailed, action-oriented suggestion that can guide real improvement work (diagnosis, countermeasures, and follow-up).

Guidance for areasOfConcern:
- Prioritize metrics with fail3 = true, then fail2 = true.
- Use latestMet and achievementRate to describe severity and risk.
- Use metricId together with the A3 cases in the provided context to identify any A3s linked to each metric.
- When linkedA3Completed > 0, briefly assess whether performance appears to have improved since those A3s were completed and state whether the A3 work seems effective or not.
- When linkedA3Total = 0 or performance is still weak despite completed A3s, explicitly recommend the next A3 step (for example: start a new A3, extend or revise an existing A3, or move to follow-up/standardization).
- Focus on actionable, metric-specific improvement suggestions (avoid generic advice).
- Suggestions should reflect typical quality, process-improvement, and problem-solving practices.
- Each suggestion should describe concrete next actions, such as specific analyses to run, experiments or pilots to try, process changes to test, and how to monitor impact over the next 2–3 months.
- Do not output your own statistical tables or detailed numerical calculations in text; focus on narrative and actions.

Return the response in STRICT JSON format with the following structure:
{
  "executiveSummary": "A concise high-level performance snapshot.",
  "a3Summary": "Narrative summary of A3 cases and portfolio status.",
  "areasOfConcern": [
    {
      "metricName": "Metric Name",
      "groupName": "Group Name",
      "issue": "Why this metric is a concern (e.g., 'Missed target for 3 consecutive months with low overall achievement rate').",
      "suggestion": "Detailed, actionable, metric-specific improvement suggestion based on the pattern and context."
    }
  ]
}

Do not include any markdown formatting (like \`\`\`json). Just the raw JSON object.`;

  const aiModelFromSettings =
    typeof dashboardSettings.aiModel === 'string' ? dashboardSettings.aiModel : null;
  const model = getValidModel(aiModelFromSettings || job.aiModel || null);

  const summary = await generateComprehensiveSummary(context, prompt, model);
  const emailSummary = buildEmailSummaryForRows(summary, rows);
  const richHtml = buildEmailHtmlForRows(summary, rows);
  const finalEmailHtml =
    richHtml && richHtml.trim() !== '' ? richHtml : buildSimpleHtmlFromText(emailSummary);

  return {
    jobToSend: {
      ...job,
      body: emailSummary,
      bodyHtml: finalEmailHtml,
    },
    dashboardSettings,
  };
};

const computeNextSendAtFromSchedule = (schedule: any, now: Date): Date | null => {
  if (!schedule || typeof schedule !== 'object') {
    return null;
  }

  const timezoneOffsetMinutes =
    typeof schedule.timezoneOffsetMinutes === 'number' && !Number.isNaN(schedule.timezoneOffsetMinutes)
      ? schedule.timezoneOffsetMinutes
      : 0;
  const offsetMs = timezoneOffsetMinutes * 60 * 1000;

  const localNow = new Date(now.getTime() - offsetMs);

  const frequency = schedule.frequency === 'monthly' ? 'monthly' : 'weekly';
  const timeOfDay = typeof schedule.timeOfDay === 'string' ? schedule.timeOfDay : '08:00';
  const [hourStr, minuteStr] = timeOfDay.split(':');
  const hour = Number(hourStr) || 8;
  const minute = Number(minuteStr) || 0;

  const rawStopDate = typeof schedule.stopDate === 'string' ? schedule.stopDate.trim() : '';
  let localStopAt: Date | null = null;
  if (rawStopDate) {
    const parsed = new Date(`${rawStopDate}T23:59:59`);
    if (!Number.isNaN(parsed.getTime())) {
      localStopAt = parsed;
    }
  }

  if (localStopAt && localNow >= localStopAt) {
    return null;
  }

  if (frequency === 'weekly') {
    const dayOfWeekRaw =
      typeof schedule.dayOfWeek === 'number' && schedule.dayOfWeek >= 1 && schedule.dayOfWeek <= 7
        ? schedule.dayOfWeek
        : 1;
    const current = new Date(localNow.getTime());
    const currentDay = current.getDay();
    const targetDay = dayOfWeekRaw === 7 ? 0 : dayOfWeekRaw;

    current.setHours(hour, minute, 0, 0);

    let diff = targetDay - currentDay;
    if (diff < 0 || (diff === 0 && current <= localNow)) {
      diff += 7;
    }
    current.setDate(current.getDate() + diff);
    if (localStopAt && current > localStopAt) {
      return null;
    }
    return new Date(current.getTime() + offsetMs);
  }

  const year = localNow.getFullYear();
  const month = localNow.getMonth();
  const dayOfMonthRaw =
    typeof schedule.dayOfMonth === 'number' && schedule.dayOfMonth >= 1 && schedule.dayOfMonth <= 31
      ? schedule.dayOfMonth
      : 1;

  const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.min(dayOfMonthRaw, daysInCurrentMonth);

  let candidate = new Date(year, month, day, hour, minute, 0, 0);
  if (candidate <= localNow) {
    const nextMonth = new Date(year, month + 1, 1);
    const daysInNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    const nextDay = Math.min(dayOfMonthRaw, daysInNextMonth);
    candidate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), nextDay, hour, minute, 0, 0);
  }

  if (localStopAt && candidate > localStopAt) {
    return null;
  }

  return new Date(candidate.getTime() + offsetMs);
};

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    try {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      const url = new URL(request.url);

      if (request.method === 'POST' && url.pathname === '/schedule-email') {
        try {
          const data = (await request.json()) as {
            userId?: string;
            recipients: string[];
            subject: string;
            body?: string;
            bodyHtml?: string;
            sendAt: string;
            mode?: 'manual' | 'autoSummary';
            aiModel?: string;
            fromName?: string;
            recurring?: boolean;
          };

          const {
            userId,
            recipients,
            subject,
            body,
            bodyHtml,
            sendAt,
            mode,
            aiModel,
            fromName,
            recurring,
          } = data;

          if (!Array.isArray(recipients) || recipients.length === 0) {
            return new Response(
              JSON.stringify({ success: false, error: 'At least one recipient is required' }),
              {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              },
            );
          }

          if (!subject) {
            return new Response(
              JSON.stringify({ success: false, error: 'Subject is required' }),
              {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              },
            );
          }

          const jobMode: 'manual' | 'autoSummary' = mode === 'autoSummary' ? 'autoSummary' : 'manual';

          if (jobMode === 'autoSummary') {
            if (!userId) {
              return new Response(
                JSON.stringify({
                  success: false,
                  error: 'userId is required for auto summary emails',
                }),
                {
                  status: 400,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                },
              );
            }
          } else if (!body) {
            return new Response(
              JSON.stringify({ success: false, error: 'Subject and body are required' }),
              {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              },
            );
          }

          let sendAtMs = Date.parse(sendAt);
          if (jobMode === 'autoSummary' && userId) {
            try {
              const response = await fetch(
                `https://bowler-worker.study-llm.me/load?userId=${encodeURIComponent(userId)}`,
                {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                },
              );
              if (response.ok) {
                const data = (await response.json()) as any;
                const dashboardSettings = data.dashboardSettings || null;
                const schedule =
                  dashboardSettings && typeof dashboardSettings === 'object'
                    ? (dashboardSettings as any).emailSchedule
                    : null;
                const next = computeNextSendAtFromSchedule(schedule, new Date());
                if (next) {
                  sendAtMs = next.getTime();
                }
              }
            } catch (e) {
              console.error('Failed to derive initial sendAt from dashboard schedule', e);
            }
          }

          if (Number.isNaN(sendAtMs)) {
            return new Response(
              JSON.stringify({ success: false, error: 'sendAt must be a valid date/time string' }),
              {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              },
            );
          }

          const id = createId('email');

          const job: ScheduledEmailJob = {
            id,
            userId: userId || null,
            recipients,
            subject,
            body: body || '',
            bodyHtml,
            sendAt: sendAtMs,
            sent: false,
            mode: jobMode,
            aiModel,
            fromName,
            recurring: recurring === true,
          };

          const tableUrl = new URL(`${getSupabaseRestUrl(env)}/scheduled_emails`);
          tableUrl.searchParams.set('on_conflict', 'id');

          const insertResponse = await fetch(tableUrl.toString(), {
            method: 'POST',
            headers: {
              ...getSupabaseHeaders(env, 'application/json'),
              Prefer: 'resolution=merge-duplicates',
            },
            body: JSON.stringify([mapJobToRow(job)]),
          });

          if (!insertResponse.ok) {
            return new Response(
              JSON.stringify({ success: false, error: 'Failed to store scheduled email' }),
              {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              },
            );
          }

          return new Response(JSON.stringify({ success: true, id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ success: false, error: err.message || String(err) }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      if (request.method === 'POST' && url.pathname === '/send-email-now') {
        try {
          const data = (await request.json()) as {
            userId?: string;
            recipients: string[];
            subject: string;
            body: string;
            bodyHtml?: string;
            fromName?: string;
          };

          const { userId, recipients, subject, body, bodyHtml, fromName } = data;

          if (!Array.isArray(recipients) || recipients.length === 0) {
            return new Response(
              JSON.stringify({ success: false, error: 'At least one recipient is required' }),
              {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              },
            );
          }

          if (!subject || !body) {
            return new Response(
              JSON.stringify({ success: false, error: 'Subject and body are required' }),
              {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              },
            );
          }

          const job: ScheduledEmailJob = {
            id: createId('email'),
            userId: userId || null,
            recipients,
            subject,
            body,
            bodyHtml,
            sendAt: Date.now(),
            sent: false,
            fromName,
          };

          await sendEmailWithResend(env, job);

          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ success: false, error: err.message || String(err) }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      if (request.method === 'GET' && url.pathname === '/list-scheduled-emails') {
        try {
          const userId = (url.searchParams.get('userId') || '').trim();
          if (!userId) {
            return new Response(
              JSON.stringify({ success: false, error: 'userId is required' }),
              {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              },
            );
          }

          const jobs: {
            id: string;
            subject: string;
            sendAt: number;
            mode?: 'manual' | 'autoSummary';
            recipients: string[];
            recurring?: boolean;
          }[] = [];

          const restUrl = new URL(`${getSupabaseRestUrl(env)}/scheduled_emails`);
          restUrl.searchParams.set('user_id', `eq.${userId}`);
          restUrl.searchParams.set('sent', 'eq.false');
          restUrl.searchParams.set('select', 'id,subject,send_at,mode,recipients,recurring');

          const res = await fetch(restUrl.toString(), {
            method: 'GET',
            headers: getSupabaseHeaders(env),
          });

          if (!res.ok) {
            return new Response(
              JSON.stringify({ success: false, error: 'Failed to load scheduled emails' }),
              {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              },
            );
          }

          const rows = (await res.json()) as any[];

          rows.forEach(row => {
            const sendAtRaw = row.send_at;
            const sendAt =
              typeof sendAtRaw === 'number'
                ? sendAtRaw
                : Date.parse(sendAtRaw || '');

            jobs.push({
              id: row.id,
              subject: row.subject || '',
              sendAt,
              mode:
                row.mode === 'autoSummary'
                  ? 'autoSummary'
                  : row.mode === 'manual'
                  ? 'manual'
                  : undefined,
              recipients: Array.isArray(row.recipients) ? row.recipients : [],
              recurring: row.recurring === true,
            });
          });

          jobs.sort((a, b) => {
            if (a.sendAt === b.sendAt) {
              return a.id.localeCompare(b.id);
            }
            return a.sendAt - b.sendAt;
          });

          return new Response(JSON.stringify({ success: true, jobs }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ success: false, error: err.message || String(err) }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      if (request.method === 'POST' && url.pathname === '/cancel-scheduled-email') {
        try {
          const data = (await request.json()) as {
            userId?: string;
            id?: string;
          };

          const userId = (data.userId || '').trim();
          const id = (data.id || '').trim();

          if (!userId || !id) {
            return new Response(
              JSON.stringify({ success: false, error: 'userId and id are required' }),
              {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              },
            );
          }

          const selectUrl = new URL(`${getSupabaseRestUrl(env)}/scheduled_emails`);
          selectUrl.searchParams.set('id', `eq.${id}`);
          selectUrl.searchParams.set('select', 'id,user_id');

          const selectResponse = await fetch(selectUrl.toString(), {
            method: 'GET',
            headers: getSupabaseHeaders(env),
          });

          if (!selectResponse.ok) {
            return new Response(
              JSON.stringify({ success: false, error: 'Failed to load scheduled email' }),
              {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              },
            );
          }

          const rows = (await selectResponse.json()) as any[];

          if (!rows || rows.length === 0) {
            return new Response(JSON.stringify({ success: true, cancelled: false }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          const row = rows[0] as any;

          const rowUserId =
            typeof row.user_id === 'string' ? row.user_id.trim() : '';
          if (rowUserId !== userId) {
            return new Response(
              JSON.stringify({ success: false, error: 'Forbidden to cancel this scheduled email' }),
              {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              },
            );
          }

          const deleteUrl = new URL(`${getSupabaseRestUrl(env)}/scheduled_emails`);
          deleteUrl.searchParams.set('id', `eq.${id}`);
          deleteUrl.searchParams.set('user_id', `eq.${userId}`);

          const deleteResponse = await fetch(deleteUrl.toString(), {
            method: 'DELETE',
            headers: getSupabaseHeaders(env),
          });

          if (!deleteResponse.ok) {
            return new Response(
              JSON.stringify({ success: false, error: 'Failed to cancel scheduled email' }),
              {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              },
            );
          }

          return new Response(JSON.stringify({ success: true, cancelled: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ success: false, error: err.message || String(err) }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (err: any) {
      return new Response(JSON.stringify({ success: false, error: err.message || String(err) }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const now = Date.now();
    const restUrl = new URL(`${getSupabaseRestUrl(env)}/scheduled_emails`);
    restUrl.searchParams.set('sent', 'eq.false');
    restUrl.searchParams.set('send_at', `lte.${now}`);
    restUrl.searchParams.set('select', '*');

    const response = await fetch(restUrl.toString(), {
      method: 'GET',
      headers: getSupabaseHeaders(env),
    });

    if (!response.ok) {
      console.error('Failed to load scheduled emails from Supabase');
      return;
    }

    const rows = (await response.json()) as any[];

    rows.forEach(row => {
      const job = mapRowToJob(row);

      if (job.sent) {
        return;
      }
      if (job.sendAt > now) {
        return;
      }

      ctx.waitUntil(
        (async () => {
          try {
            let jobToSend = job;
            let dashboardSettingsForJob: any | null = null;
            if (job.mode === 'autoSummary') {
              const result = await buildAutoSummaryForJob(job);
              jobToSend = result.jobToSend;
              dashboardSettingsForJob = result.dashboardSettings;
            }
            await sendEmailWithResend(env, jobToSend);

            if (job.mode === 'autoSummary' && dashboardSettingsForJob && dashboardSettingsForJob.emailSchedule) {
              const next = computeNextSendAtFromSchedule(
                dashboardSettingsForJob.emailSchedule,
                new Date(now),
              );
              if (next) {
                job.sendAt = next.getTime();
                job.sent = false;
              } else {
                job.sent = true;
              }
            } else if (job.recurring && job.userId) {
              try {
                const bowlerResponse = await fetch(
                  `https://bowler-worker.study-llm.me/load?userId=${encodeURIComponent(job.userId)}`,
                  {
                    method: 'GET',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                  },
                );
                if (bowlerResponse.ok) {
                  const data = (await bowlerResponse.json()) as any;
                  const dashboardSettings = data.dashboardSettings || null;
                  const schedule =
                    dashboardSettings && typeof dashboardSettings === 'object'
                      ? (dashboardSettings as any).emailSchedule
                      : null;
                  const next = computeNextSendAtFromSchedule(schedule, new Date(now));
                  if (next) {
                    job.sendAt = next.getTime();
                    job.sent = false;
                  } else {
                    job.sent = true;
                  }
                } else {
                  job.sent = true;
                }
              } catch (e) {
                console.error('Failed to compute next send time for recurring manual email', e);
                job.sent = true;
              }
            } else {
              job.sent = true;
            }

            const updateUrl = new URL(`${getSupabaseRestUrl(env)}/scheduled_emails`);
            updateUrl.searchParams.set('id', `eq.${job.id}`);

            const patchBody: any = {
              sent: job.sent,
              send_at: job.sendAt,
            };

            const updateResponse = await fetch(updateUrl.toString(), {
              method: 'PATCH',
              headers: getSupabaseHeaders(env, 'application/json'),
              body: JSON.stringify(patchBody),
            });

            if (!updateResponse.ok) {
              console.error('Failed to update scheduled email status in Supabase');
            }
          } catch (err) {
            console.error('Failed to send scheduled email', err);
          }
        })(),
      );
    });
  },
};
