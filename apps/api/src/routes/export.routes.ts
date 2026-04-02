import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { audit } from '../lib/audit.js';
import { getBrainExportData } from '../services/viral.service.js';
import type { BrainExportData } from '../services/viral.service.js';

/**
 * Generates a well-formatted HTML page suitable for printing/saving as PDF.
 * Uses print-friendly CSS with clean typography.
 */
function generateExportHtml(data: BrainExportData): string {
  const escapeHtml = (str: string): string =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const sections: string[] = [];

  // Profile section
  if (data.profile.summary) {
    const traits = Object.entries(data.profile.traits);
    const prefs = Object.entries(data.profile.preferences);

    let traitsHtml = '';
    if (traits.length > 0) {
      traitsHtml = `
        <h3>Traits</h3>
        <ul>${traits.map(([k, v]) => `<li><strong>${escapeHtml(k)}</strong>: ${escapeHtml(String(v))}</li>`).join('')}</ul>
      `;
    }

    let prefsHtml = '';
    if (prefs.length > 0) {
      prefsHtml = `
        <h3>Preferences</h3>
        <ul>${prefs.map(([k, v]) => `<li><strong>${escapeHtml(k)}</strong>: ${escapeHtml(String(v))}</li>`).join('')}</ul>
      `;
    }

    sections.push(`
      <section>
        <h2>Profile</h2>
        <p>${escapeHtml(data.profile.summary)}</p>
        ${traitsHtml}
        ${prefsHtml}
      </section>
    `);
  }

  // Memories grouped by type
  if (data.memories.length > 0) {
    const grouped = new Map<string, typeof data.memories>();
    for (const mem of data.memories) {
      const list = grouped.get(mem.type) ?? [];
      list.push(mem);
      grouped.set(mem.type, list);
    }

    let memoriesHtml = '';
    for (const [type, items] of grouped) {
      memoriesHtml += `<h3>${escapeHtml(type)}</h3><ul>`;
      for (const item of items) {
        const body = item.body ? `: ${escapeHtml(item.body)}` : '';
        memoriesHtml += `<li><strong>${escapeHtml(item.title)}</strong>${body}</li>`;
      }
      memoriesHtml += '</ul>';
    }

    sections.push(`
      <section>
        <h2>Memories</h2>
        ${memoriesHtml}
      </section>
    `);
  }

  // Entities
  if (data.entities.length > 0) {
    const entityItems = data.entities
      .map((e) => {
        const desc = e.description ? `: ${escapeHtml(e.description)}` : '';
        return `<li><strong>${escapeHtml(e.name)}</strong> (${escapeHtml(e.type)})${desc}</li>`;
      })
      .join('');

    sections.push(`
      <section>
        <h2>Entities</h2>
        <ul>${entityItems}</ul>
      </section>
    `);
  }

  // Projects
  if (data.projects.length > 0) {
    const projectItems = data.projects
      .map((p) => {
        const desc = p.description ? `: ${escapeHtml(p.description)}` : '';
        return `<li><strong>${escapeHtml(p.name)}</strong> [${escapeHtml(p.status)}]${desc}</li>`;
      })
      .join('');

    sections.push(`
      <section>
        <h2>Projects</h2>
        <ul>${projectItems}</ul>
      </section>
    `);
  }

  const timestamp = new Date().toISOString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OneBrain Export</title>
  <style>
    @media print {
      body { margin: 0; padding: 20mm; }
      .no-print { display: none; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI',
        Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #111;
      background: #fff;
      line-height: 1.6;
    }
    h1 {
      font-size: 28px;
      margin-bottom: 8px;
      border-bottom: 2px solid #111;
      padding-bottom: 8px;
    }
    .meta {
      color: #666;
      font-size: 13px;
      margin-bottom: 32px;
    }
    h2 {
      font-size: 22px;
      margin-top: 32px;
      margin-bottom: 12px;
      color: #222;
    }
    h3 {
      font-size: 16px;
      margin-top: 16px;
      margin-bottom: 8px;
      color: #444;
      text-transform: capitalize;
    }
    ul {
      padding-left: 24px;
      margin-bottom: 12px;
    }
    li {
      margin-bottom: 6px;
    }
    section {
      margin-bottom: 24px;
    }
    p {
      margin-bottom: 12px;
    }
  </style>
</head>
<body>
  <h1>OneBrain Export</h1>
  <p class="meta">Generated: ${escapeHtml(timestamp)}</p>
  ${sections.join('\n')}
</body>
</html>`;
}

export async function exportRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requireAuth);

  /** GET /v1/export/pdf — Export brain as printable HTML */
  app.get('/v1/export/pdf', async (request, reply) => {
    const data = await getBrainExportData(request.userId);
    const html = generateExportHtml(data);

    audit(request.userId, 'export', 'brain', undefined, {
      format: 'pdf',
    });

    return reply
      .header('Content-Type', 'text/html; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="onebrain-export.html"')
      .send(html);
  });
}
